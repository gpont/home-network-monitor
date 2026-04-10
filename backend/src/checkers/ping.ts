import { db } from "../db/client.ts";
import { pingResults, tcpConnectResults } from "../db/schema.ts";
import { spawn, now } from "./utils.ts";

export interface PingTarget {
  host: string;
  label: string;
  ipv6?: boolean;
}

export interface PingResult {
  target: string;
  targetLabel: string;
  status: "ok" | "timeout" | "error";
  rttMs: number | null;
  timestamp: number;
}

// Auto-detect default gateway
export async function detectGateway(): Promise<string | null> {
  try {
    // Linux
    const result = await spawn(["ip", "route", "show", "default"], 3000);
    const match = result.stdout.match(/default via (\S+)/);
    if (match?.[1]) return match[1];
  } catch {}

  try {
    // macOS fallback
    const result = await spawn(["netstat", "-rn"], 3000);
    const lines = result.stdout.split("\n");
    for (const line of lines) {
      if (line.startsWith("default") || line.startsWith("0.0.0.0")) {
        const parts = line.trim().split(/\s+/);
        if (parts[1] && !parts[1].includes("link")) return parts[1];
      }
    }
  } catch {}

  return null;
}

export async function pingHost(
  host: string,
  label: string,
  ipv6 = false
): Promise<PingResult> {
  const ts = now();
  const cmd = ipv6
    ? ["ping6", "-c", "3", "-W", "2", host]
    : ["ping", "-c", "3", "-W", "2", host];

  const result = await spawn(cmd, 8000);

  if (result.exitCode === -1) {
    return { target: host, targetLabel: label, status: "timeout", rttMs: null, timestamp: ts };
  }

  if (result.exitCode !== 0) {
    return { target: host, targetLabel: label, status: "error", rttMs: null, timestamp: ts };
  }

  // Parse avg RTT from: rtt min/avg/max/mdev = 1.234/2.345/3.456/0.123 ms
  const rttMatch = result.stdout.match(/rtt min\/avg\/max\/mdev = [\d.]+\/([\d.]+)/);
  // macOS format: round-trip min/avg/max/stddev = 1.234/2.345/3.456/0.123 ms
  const rttMatchMac = result.stdout.match(/round-trip min\/avg\/max\/stddev = [\d.]+\/([\d.]+)/);
  const rttMs = rttMatch?.[1]
    ? parseFloat(rttMatch[1])
    : rttMatchMac?.[1]
    ? parseFloat(rttMatchMac[1])
    : null;

  // Check for packet loss
  const lossMatch = result.stdout.match(/(\d+)% packet loss/);
  const loss = lossMatch?.[1] ? parseInt(lossMatch[1]) : 0;

  if (loss === 100) {
    return { target: host, targetLabel: label, status: "timeout", rttMs: null, timestamp: ts };
  }

  return {
    target: host,
    targetLabel: label,
    status: "ok",
    rttMs,
    timestamp: ts,
  };
}

export async function runPingChecks(targets: PingTarget[]): Promise<PingResult[]> {
  const results = await Promise.all(
    targets.map((t) => pingHost(t.host, t.label, t.ipv6))
  );

  await db.insert(pingResults).values(
    results.map((r) => ({
      target: r.target,
      targetLabel: r.targetLabel,
      status: r.status,
      rttMs: r.rttMs,
      timestamp: r.timestamp,
    }))
  );

  return results;
}

export async function checkTcpConnect(host: string, port: number): Promise<{ status: "ok" | "timeout" | "error"; latencyMs: number | null }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ status: "timeout", latencyMs: null }), 3000);
    Bun.connect({ hostname: host, port, socket: {
      open(sock) {
        clearTimeout(timer);
        resolve({ status: "ok", latencyMs: Date.now() - start });
        sock.end();
      },
      error() { clearTimeout(timer); resolve({ status: "error", latencyMs: null }); },
      close() {},
      data() {},
    }}).catch(() => { clearTimeout(timer); resolve({ status: "error", latencyMs: null }); });
  });
}

export async function runTcpConnectCheck(host = "1.1.1.1", port = 443) {
  const result = await checkTcpConnect(host, port);
  await db.insert(tcpConnectResults).values({
    host,
    port,
    status: result.status,
    latencyMs: result.latencyMs,
    timestamp: now(),
  });
  return result;
}

export interface PingStats {
  lossPercent: number;
  avgRttMs: number | null;
  jitterMs: number | null;
}

export function computePingStats(rows: Array<{ target: string; rttMs: number | null; status: string }>): Record<string, PingStats> {
  const grouped: Record<string, typeof rows> = {};
  for (const row of rows) {
    if (!grouped[row.target]) grouped[row.target] = [];
    grouped[row.target]!.push(row);
  }

  const result: Record<string, PingStats> = {};
  for (const [target, entries] of Object.entries(grouped)) {
    const total = entries.length;
    const failed = entries.filter(e => e.status !== "ok").length;
    const rtts = entries.filter(e => e.rttMs !== null).map(e => e.rttMs as number);
    const avgRttMs = rtts.length > 0 ? rtts.reduce((a, b) => a + b, 0) / rtts.length : null;

    let jitterMs: number | null = null;
    if (rtts.length >= 2) {
      const diffs = rtts.slice(1).map((v, i) => Math.abs(v - (rtts[i] ?? 0)));
      jitterMs = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    }

    result[target] = {
      lossPercent: total > 0 ? (failed / total) * 100 : 0,
      avgRttMs,
      jitterMs,
    };
  }
  return result;
}
