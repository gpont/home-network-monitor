import { db } from "../db/client.ts";
import { tracerouteResults } from "../db/schema.ts";
import { spawn, now } from "./utils.ts";
import { eq, desc } from "drizzle-orm";

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

export async function runTraceroute(target = "8.8.8.8"): Promise<TracerouteResult> {
  const ts = now();

  // -n: no DNS, -w 1: 1s timeout per hop, -m 20: max 20 hops
  const result = await spawn(
    ["traceroute", "-n", "-w", "1", "-m", "20", target],
    30000
  );

  const hops: Hop[] = [];
  const lines = result.stdout.split("\n").slice(1); // skip header

  for (const line of lines) {
    const hopMatch = line.match(/^\s*(\d+)\s+(.+)/);
    if (!hopMatch) continue;

    const hopNum = parseInt(hopMatch[1]!);
    const rest = hopMatch[2]!;

    if (rest.trim() === "* * *") {
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
    const prevIps = prevHops.filter((h) => h.ip).map((h) => h.ip);
    const currIps = hops.filter((h) => h.ip).map((h) => h.ip);

    // Check if first 5 significant hops changed
    const prevKey = prevIps.slice(0, 5).join(",");
    const currKey = currIps.slice(0, 5).join(",");
    routingChanged = prevKey !== currKey && prevKey !== "";
  }

  await db.insert(tracerouteResults).values({
    target,
    hops: JSON.stringify(hops),
    routingChanged,
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
