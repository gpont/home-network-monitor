import { db } from "../db/client.ts";
import { tracerouteResults } from "../db/schema.ts";
import { spawn, now } from "./utils.ts";
import { eq, desc } from "drizzle-orm";
import { detectBlackHole } from "./misc.ts";

export interface Hop {
  hop: number;
  ip: string | null;
  rttMs: number | null;
}

export interface TracerouteResult {
  target: string;
  hops: Hop[];
  routingChanged: boolean;
  timestamp: number;
}

export function parseTracerouteOutput(stdout: string): Hop[] {
  const hops: Hop[] = [];
  const lines = stdout.split("\n").slice(1); // skip header

  for (const line of lines) {
    const hopMatch = line.match(/^\s*(\d+)\s+(.+)/);
    if (!hopMatch) continue;

    const hopNum = parseInt(hopMatch[1]!);
    const rest = hopMatch[2]!;

    if (/^\*[\s*]+$/.test(rest.trim())) {
      hops.push({ hop: hopNum, ip: null, rttMs: null });
      continue;
    }

    const ipMatch = rest.match(/(\d+\.\d+\.\d+\.\d+)/);
    const rttMatch = rest.match(/([\d.]+) ms/);

    hops.push({
      hop: hopNum,
      ip: ipMatch?.[1] ?? null,
      rttMs: rttMatch ? parseFloat(rttMatch[1]!) : null,
    });
  }

  return hops;
}

/** Convert IP to /24 subnet string: "212.200.179.11" → "212.200.179" */
function toSubnet(ip: string): string {
  return ip.split(".").slice(0, 3).join(".");
}

/**
 * Returns true only if the upstream route changed significantly.
 * Tolerates ECMP load-balancing: IPs within the same /24 subnet on the
 * same hop position are treated as equivalent.
 * A change is only flagged when >50% of comparable hops moved to a
 * different /24.
 */
export function routingChangedBetween(prevHops: Hop[], currHops: Hop[]): boolean {
  const prevIps = prevHops.filter((h) => h.ip).map((h) => h.ip as string);
  const currIps = currHops.filter((h) => h.ip).map((h) => h.ip as string);

  if (prevIps.length === 0 || currIps.length === 0) return false;

  const len = Math.min(prevIps.length, currIps.length, 6); // check up to 6 hops
  if (len === 0) return false;

  let changed = 0;
  for (let i = 0; i < len; i++) {
    if (toSubnet(prevIps[i]!) !== toSubnet(currIps[i]!)) changed++;
  }

  // Flag as changed only if majority of hops are in different subnets
  return changed > len / 2;
}

export async function runTraceroute(target = "8.8.8.8"): Promise<TracerouteResult> {
  const ts = now();

  // -n: no DNS, -w 1: 1s timeout per hop, -m 20: max 20 hops
  const result = await spawn(
    ["traceroute", "-n", "-w", "1", "-m", "20", target],
    30000
  );

  const hops = parseTracerouteOutput(result.stdout);

  // Compare with previous traceroute to detect routing changes
  const previous = await db
    .select()
    .from(tracerouteResults)
    .where(eq(tracerouteResults.target, target))
    .orderBy(desc(tracerouteResults.timestamp))
    .limit(1);

  let routingChanged = false;
  if (previous.length > 0 && previous[0]) {
    const prevHops: Hop[] = JSON.parse(previous[0].hops);
    routingChanged = routingChangedBetween(prevHops, hops);
  }

  await db.insert(tracerouteResults).values({
    target,
    hops: JSON.stringify(hops),
    routingChanged,
    hasBlackHole: detectBlackHole(hops),
    timestamp: ts,
  });

  return { target, hops, routingChanged, timestamp: ts };
}

// Also extract ISP first hop (first non-RFC1918 IP)
export function extractIspHop(hops: Hop[]): string | null {
  const rfc1918 = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.)/;
  for (const hop of hops) {
    if (hop.ip && !rfc1918.test(hop.ip)) {
      return hop.ip;
    }
  }
  return null;
}
