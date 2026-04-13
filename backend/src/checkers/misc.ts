import { db } from "../db/client.ts";
import { miscChecks, sslChecks, networkStats } from "../db/schema.ts";
import { spawn, now } from "./utils.ts";

// ─── CGNAT detection ──────────────────────────────────────────────────────────
// If first non-RFC1918 hop after the router is itself in 100.64.0.0/10 → CGNAT
export async function checkCgnat(ispHopIp: string | null) {
  const ts = now();

  let status = "unknown";
  let value: Record<string, unknown> = {};

  if (ispHopIp) {
    const cgnatRange = /^100\.(6[4-9]|[7-9]\d|1([01]\d|2[0-7]))\./;
    if (cgnatRange.test(ispHopIp)) {
      status = "cgnat";
      value = { ispHop: ispHopIp };
    } else {
      status = "direct";
      value = { ispHop: ispHopIp };
    }
  }

  await db.insert(miscChecks).values({
    type: "cgnat",
    status,
    value: JSON.stringify(value),
    timestamp: ts,
  });

  return { type: "cgnat", status, value, timestamp: ts };
}

// ─── MTU check ─────────────────────────────────────────────────────────────────
// Try to send a packet that would be 1500 bytes total with DF bit set
export async function checkMtu() {
  const ts = now();

  // Sizes = desired MTU - 20 (IP header) - 8 (ICMP header)
  // 1472 → 1500 (Ethernet standard)
  // 1464 → 1492 (PPPoE standard)
  // 1452 → 1480 (PPPoE with some overhead / tunnels)
  // 1400 → 1428 (some VPNs / restrictive ISPs)
  const sizes = [1472, 1464, 1452, 1400, 1300, 576];
  let maxOk = 0;
  let status = "ok";

  for (const size of sizes) {
    // -M do = don't fragment (Linux), -D = macOS
    // -W on Linux = seconds, on macOS = milliseconds
    const cmd = process.platform === "darwin"
      ? ["ping", "-D", "-c", "1", "-W", "2000", "-s", String(size), "8.8.8.8"]
      : ["ping", "-M", "do", "-c", "1", "-W", "2", "-s", String(size), "8.8.8.8"];

    const result = await spawn(cmd, 5000);
    if (result.exitCode === 0) {
      maxOk = size + 28; // add IP+ICMP headers back
      break;
    }
  }

  if (maxOk === 0) {
    status = "error";
  } else if (maxOk < 1500) {
    status = "fragmentation_detected";
  }

  const value = { maxMtu: maxOk || null };
  await db.insert(miscChecks).values({
    type: "mtu",
    status,
    value: JSON.stringify(value),
    timestamp: ts,
  });

  return { type: "mtu", status, value, timestamp: ts };
}

// ─── IPv6 connectivity ─────────────────────────────────────────────────────────
export async function checkIpv6() {
  const ts = now();
  const result = await spawn(
    ["ping6", "-c", "2", "-W", "3", "2001:4860:4860::8888"],
    8000
  );

  const status = result.exitCode === 0 ? "ok" : "unavailable";
  await db.insert(miscChecks).values({
    type: "ipv6",
    status,
    value: null,
    timestamp: ts,
  });

  return { type: "ipv6", status, timestamp: ts };
}

// ─── DHCP lease ────────────────────────────────────────────────────────────────

export function parseDhcpMacOs(out: string): { status: string; value: Record<string, unknown> } {
  if (!out.trim()) return { status: "unknown", value: {} };
  // Check for ACK (DHCP success)
  const isDhcp = /dhcp_message_type.*ACK/i.test(out);
  const isPppoe = /pppoe/i.test(out);
  if (isPppoe) return { status: "pppoe_up", value: { connectionType: "pppoe" } };
  if (isDhcp) return { status: "ok", value: { connectionType: "dhcp" } };
  return { status: "unknown", value: {} };
}

export async function checkDhcp() {
  const ts = now();

  let status = "unknown";
  let value: Record<string, unknown> = {};

  try {
    if (process.platform === "darwin") {
      // Find primary interface from route table
      const routeOut = await spawn(["netstat", "-rn"], 3000);
      const ifMatch = routeOut.stdout.match(/^default\s+\S+\s+\S+\s+(\S+)/m);
      const iface = ifMatch?.[1] ?? "en0";
      const pktOut = await spawn(["ipconfig", "getpacket", iface], 3000).catch(() => ({ stdout: "" }));
      ({ status, value } = parseDhcpMacOs(pktOut.stdout));
    } else {
      // Linux path
      const result = await spawn(["ip", "link", "show"], 3000);
      // Check if ppp0 exists (PPPoE)
      if (result.stdout.includes("ppp0")) {
        const pppResult = await spawn(["ip", "link", "show", "ppp0"], 3000);
        const up = pppResult.stdout.includes("UP");
        status = up ? "pppoe_up" : "pppoe_down";
        value = { interface: "ppp0", up };
      } else {
        // Try reading dhclient lease file
        const leaseFile = await Bun.file("/var/lib/dhcp/dhclient.leases").text().catch(() => null);
        if (leaseFile) {
          const expiryMatch = leaseFile.match(/expire \d+ ([\d\/: ]+);/g);
          if (expiryMatch && expiryMatch.length > 0) {
            const lastExpiry = expiryMatch[expiryMatch.length - 1];
            status = "ok";
            value = { leaseExpiry: lastExpiry ?? null };
          }
        } else {
          status = "ok"; // Can't read lease but interface is up
        }
      }
    }
  } catch {
    status = "error";
  }

  await db.insert(miscChecks).values({
    type: "dhcp",
    status,
    value: JSON.stringify(value),
    timestamp: ts,
  });

  return { type: "dhcp", status, value, timestamp: ts };
}

// ─── Network interface stats ─────────────────────────────────────────────────

export function parseNetstatInterfaceStats(
  ifname: string,
  out: string
): { interface: string; rxBytes: number; txBytes: number; rxErrors: number; txErrors: number; rxDropped: number; txDropped: number } | null {
  const line = out.split("\n").find(l => {
    const trimmed = l.trim();
    return (trimmed.startsWith(ifname + " ") || trimmed.startsWith(ifname + "\t")) && l.includes("<Link#");
  });
  if (!line) return null;
  const parts = line.trim().split(/\s+/);
  // Columns: 0=Name 1=Mtu 2=Network 3=Address 4=Ipkts 5=Ierrs 6=Ibytes 7=Opkts 8=Oerrs 9=Obytes
  return {
    interface: ifname,
    rxBytes: parseInt(parts[6] ?? "0"),
    txBytes: parseInt(parts[9] ?? "0"),
    rxErrors: parseInt(parts[5] ?? "0"),
    txErrors: parseInt(parts[8] ?? "0"),
    rxDropped: 0,
    txDropped: 0,
  };
}

export async function checkNetworkStats() {
  const ts = now();

  if (process.platform === "darwin") {
    // Find primary interface
    const routeOut = await spawn(["netstat", "-rn"], 3000).catch(() => ({ stdout: "" }));
    const ifMatch = routeOut.stdout.match(/^default\s+\S+\s+\S+\s+(\S+)/m);
    const iface = ifMatch?.[1] ?? "en0";

    const statsOut = await spawn(["netstat", "-I", iface, "-b"], 3000).catch(() => ({ stdout: "" }));
    const row = parseNetstatInterfaceStats(iface, statsOut.stdout);
    if (!row) return [];

    const result = { ...row, timestamp: ts };
    await db.insert(networkStats).values(result);
    return [result];
  }

  // Read /proc/net/dev (Linux only)
  const content = await Bun.file("/proc/net/dev").text().catch(() => null);
  if (!content) return [];

  const results = [];
  const lines = content.split("\n").slice(2); // skip 2 header lines

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const [iface, ...nums] = trimmed.split(/[:\s]+/);
    if (!iface || iface === "lo") continue; // skip loopback

    const n = nums.map(Number);
    // Format: rx_bytes rx_packets rx_errs rx_drop ... tx_bytes tx_packets tx_errs tx_drop
    const row = {
      interface: iface,
      rxBytes: n[0] ?? 0,
      rxErrors: n[2] ?? 0,
      rxDropped: n[3] ?? 0,
      txBytes: n[8] ?? 0,
      txErrors: n[10] ?? 0,
      txDropped: n[11] ?? 0,
      timestamp: ts,
    };

    results.push(row);
  }

  if (results.length > 0) {
    await db.insert(networkStats).values(results);
  }

  return results;
}

// ─── Black hole detection ──────────────────────────────────────────────────
export function detectBlackHole(hops: Array<{ hop: number; ip: string | null; rttMs: number | null }>): boolean {
  let consecutive = 0;
  for (const hop of hops) {
    if (hop.ip === null) {
      consecutive++;
      if (consecutive >= 3) return true;
    } else {
      consecutive = 0;
    }
  }
  return false;
}

// ─── SSL certificate check ─────────────────────────────────────────────────
export async function checkSslCert(host: string) {
  const ts = now();

  try {
    const res = await fetch(`https://${host}`, {
      signal: AbortSignal.timeout(10000),
    });

    // Bun exposes TLS info on the response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tls = (res as any).tls;
    if (tls?.validTo) {
      const expiresAt = new Date(tls.validTo).getTime();
      const daysRemaining = Math.floor((expiresAt - ts) / 86400000);
      const status = daysRemaining < 0 ? "expired" : daysRemaining < 30 ? "warning" : "ok";

      await db.insert(sslChecks).values({
        host,
        expiresAt,
        daysRemaining,
        status,
        error: null,
        timestamp: ts,
      });
      return { host, expiresAt, daysRemaining, status, timestamp: ts };
    }

    // Fallback: use openssl to check cert
    const result = await spawn(
      ["openssl", "s_client", "-connect", `${host}:443`, "-servername", host],
      10000
    );

    const notAfterMatch = result.stdout.match(/notAfter=(.+)/);
    if (notAfterMatch?.[1]) {
      const expiresAt = new Date(notAfterMatch[1]).getTime();
      const daysRemaining = Math.floor((expiresAt - ts) / 86400000);
      const status = daysRemaining < 0 ? "expired" : daysRemaining < 30 ? "warning" : "ok";

      await db.insert(sslChecks).values({
        host,
        expiresAt,
        daysRemaining,
        status,
        error: null,
        timestamp: ts,
      });
      return { host, expiresAt, daysRemaining, status, timestamp: ts };
    }

    await db.insert(sslChecks).values({
      host,
      expiresAt: null,
      daysRemaining: null,
      status: "ok",
      error: null,
      timestamp: ts,
    });
    return { host, expiresAt: null, daysRemaining: null, status: "ok", timestamp: ts };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await db.insert(sslChecks).values({
      host,
      expiresAt: null,
      daysRemaining: null,
      status: "error",
      error,
      timestamp: ts,
    });
    return { host, expiresAt: null, daysRemaining: null, status: "error", error, timestamp: ts };
  }
}
