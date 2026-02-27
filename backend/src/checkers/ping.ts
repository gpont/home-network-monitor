import { db } from "../db/client.ts";
import { pingResults } from "../db/schema.ts";
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
