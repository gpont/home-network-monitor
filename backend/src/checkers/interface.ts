import { db } from "../db/client.ts";
import { interfaceChecks } from "../db/schema.ts";
import { spawn, now } from "./utils.ts";

export function parseIpLinkOutput(out: string): { name: string; status: "up" | "down" | "unknown" } {
  const m = out.match(/\d+:\s+(\S+):.*state\s+(UP|DOWN)/i);
  if (!m) return { name: "unknown", status: "unknown" };
  return { name: (m[1] ?? "unknown").replace(/@.*/, ""), status: (m[2] ?? "").toUpperCase() === "UP" ? "up" : "down" };
}

export function parseIpAddrOutput(out: string): { ipv4: string | null; ipv6LinkLocal: string | null } {
  const v4 = out.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
  const v6 = out.match(/inet6\s+(fe80:[^\s/]+)/i);
  return { ipv4: v4?.[1] ?? null, ipv6LinkLocal: v6?.[1] ?? null };
}

export function parseIpRouteOutput(out: string): { gatewayIp: string | null; connectionType: "dhcp" | "pppoe" | "static" | "unknown" } {
  const m = out.match(/default via (\S+)/);
  if (!m) return { gatewayIp: null, connectionType: "unknown" };
  const pppoe = /ppp\d/.test(out);
  const dhcp = /dhcp/.test(out);
  return {
    gatewayIp: m[1] ?? null,
    connectionType: pppoe ? "pppoe" : dhcp ? "dhcp" : "static",
  };
}

export function parseArpOutput(ip: string, out: string): string | null {
  const escaped = ip.replace(/\./g, "\\.");
  const m = out.match(new RegExp(`${escaped}\\s+ether\\s+([\\da-f:]+)`, "i"));
  return m?.[1] ?? null;
}

export function parseIfconfigOutput(out: string): {
  name: string;
  status: "up" | "down" | "unknown";
  ipv4: string | null;
  ipv6LinkLocal: string | null;
} {
  // Collect all physical (non-loopback) interface sections, pick first with an inet address
  const ifaceRe = /^(en\d+|eth\d+|wlan\d+):.*flags=\S+<([^>]+)>/gm;
  const nextHeaderRe = /^[\w]+\d[\w.]*:/m;

  type IfaceResult = { name: string; status: "up" | "down" | "unknown"; ipv4: string | null; ipv6LinkLocal: string | null };
  let firstFound: IfaceResult | null = null;

  let match: RegExpExecArray | null;
  while ((match = ifaceRe.exec(out)) !== null) {
    const name = match[1] ?? "unknown";
    const flags = match[2] ?? "";
    const status: "up" | "down" | "unknown" = flags.includes("UP") ? "up" : "down";

    // Extract this interface's section (up to the next interface header)
    const sectionStart = match.index;
    const afterHeader = sectionStart + match[0].length;
    const nextMatch = out.slice(afterHeader).match(nextHeaderRe);
    const section = nextMatch?.index != null
      ? out.slice(sectionStart, afterHeader + nextMatch.index)
      : out.slice(sectionStart);

    const v4 = section.match(/\binet\s+(\d+\.\d+\.\d+\.\d+)/);
    const v6 = section.match(/\binet6\s+(fe80:[^\s%/]+)/i);

    const result: IfaceResult = {
      name,
      status,
      ipv4: v4?.[1] ?? null,
      ipv6LinkLocal: v6?.[1] ?? null,
    };

    // Prefer the first interface with an IPv4 address; keep first found as fallback
    if (!firstFound) firstFound = result;
    if (v4) return result;
  }

  return firstFound ?? { name: "unknown", status: "unknown", ipv4: null, ipv6LinkLocal: null };
}

export function parseNetstatRouteOutput(out: string): {
  gatewayIp: string | null;
  connectionType: "dhcp" | "pppoe" | "static" | "unknown";
} {
  const m = out.match(/^default\s+(\d+\.\d+\.\d+\.\d+)/m);
  if (!m) return { gatewayIp: null, connectionType: "unknown" };
  const pppoe = /ppp\d/.test(out);
  // macOS: cannot distinguish DHCP vs static from netstat -rn alone.
  // "static" detection requires `ipconfig getpacket <iface>` (handled in checkDhcp).
  // Default to "dhcp" as most home networks use DHCP.
  return {
    gatewayIp: m[1] ?? null,
    connectionType: pppoe ? "pppoe" : "dhcp",
  };
}

export function parseNetstatIfaceStats(
  ifname: string,
  out: string
): { rxErrors: number; txErrors: number; rxDropped: number; txDropped: number } {
  const line = out.split("\n").find(l => l.trim().startsWith(ifname) && l.includes("<Link#"));
  if (!line) return { rxErrors: 0, txErrors: 0, rxDropped: 0, txDropped: 0 };
  const parts = line.trim().split(/\s+/);
  // Columns (0-indexed): 0=Name 1=Mtu 2=Network 3=Address 4=Ipkts 5=Ierrs 6=Ibytes 7=Opkts 8=Oerrs
  return {
    rxErrors: parseInt(parts[5] ?? "0"),
    txErrors: parseInt(parts[8] ?? "0"),
    rxDropped: 0,  // not available in this netstat view on macOS
    txDropped: 0,
  };
}

export async function checkInterface() {
  const timestamp = now();
  try {
    if (process.platform === "darwin") {
      return await checkInterfaceMacOs(timestamp);
    } else {
      return await checkInterfaceLinux(timestamp);
    }
  } catch {
    const result = {
      interfaceName: "unknown", status: "unknown" as const,
      ipv4: null, ipv6LinkLocal: null, gatewayIp: null, gatewayMac: null,
      connectionType: "unknown" as const,
      rxErrors: 0, txErrors: 0, rxDropped: 0, txDropped: 0,
      timestamp,
    };
    await db.insert(interfaceChecks).values(result);
    return result;
  }
}

async function checkInterfaceLinux(timestamp: number) {
  const [linkOut, addrOut, routeOut] = await Promise.all([
    spawn(["ip", "link", "show"], 3000),
    spawn(["ip", "addr", "show"], 3000),
    spawn(["ip", "route", "show", "default"], 3000),
  ]);

  const link = parseIpLinkOutput(linkOut.stdout);
  const addr = parseIpAddrOutput(addrOut.stdout);
  const route = parseIpRouteOutput(routeOut.stdout);

  let gatewayMac: string | null = null;
  if (route.gatewayIp) {
    const arpOut = await spawn(["arp", "-n", route.gatewayIp], 2000).catch(() => ({ stdout: "" }));
    gatewayMac = parseArpOutput(route.gatewayIp, arpOut.stdout);
  }

  let rxErrors = 0, txErrors = 0, rxDropped = 0, txDropped = 0;
  try {
    const procOut = await Bun.file("/proc/net/dev").text();
    const line = procOut.split("\n").find(l => l.includes(link.name));
    if (line) {
      const parts = line.trim().split(/\s+/);
      rxErrors = parseInt(parts[3] ?? "0");
      rxDropped = parseInt(parts[4] ?? "0");
      txErrors = parseInt(parts[11] ?? "0");
      txDropped = parseInt(parts[12] ?? "0");
    }
  } catch { /* not on Linux */ }

  const result = {
    interfaceName: link.name,
    status: link.status,
    ipv4: addr.ipv4,
    ipv6LinkLocal: addr.ipv6LinkLocal,
    gatewayIp: route.gatewayIp,
    gatewayMac,
    connectionType: route.connectionType,
    rxErrors, txErrors, rxDropped, txDropped,
    timestamp,
  };

  await db.insert(interfaceChecks).values(result);
  return result;
}

async function checkInterfaceMacOs(timestamp: number) {
  const [ifconfigOut, routeOut] = await Promise.all([
    spawn(["ifconfig", "-a"], 3000),
    spawn(["netstat", "-rn"], 3000),
  ]);
  const parsed = parseIfconfigOutput(ifconfigOut.stdout);
  const route = parseNetstatRouteOutput(routeOut.stdout);

  let gatewayMac: string | null = null;
  if (route.gatewayIp) {
    const arpOut = await spawn(["arp", "-n", route.gatewayIp], 2000).catch(() => ({ stdout: "" }));
    gatewayMac = parseArpOutput(route.gatewayIp, arpOut.stdout);
  }

  let rxErrors = 0, txErrors = 0, rxDropped = 0, txDropped = 0;
  if (parsed.name !== "unknown") {
    const statsOut = await spawn(["netstat", "-I", parsed.name, "-b"], 3000).catch(() => ({ stdout: "" }));
    const stats = parseNetstatIfaceStats(parsed.name, statsOut.stdout);
    ({ rxErrors, txErrors, rxDropped, txDropped } = stats);
  }

  const result = {
    interfaceName: parsed.name,
    status: parsed.status,
    ipv4: parsed.ipv4,
    ipv6LinkLocal: parsed.ipv6LinkLocal,
    gatewayIp: route.gatewayIp,
    gatewayMac,
    connectionType: route.connectionType,
    rxErrors, txErrors, rxDropped, txDropped,
    timestamp,
  };
  await db.insert(interfaceChecks).values(result);
  return result;
}
