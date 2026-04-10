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

export async function checkInterface() {
  const timestamp = now();
  try {
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
