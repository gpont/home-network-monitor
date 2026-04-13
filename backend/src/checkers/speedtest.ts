import { db } from "../db/client.ts";
import { speedtestResults } from "../db/schema.ts";
import { now } from "./utils.ts";

export interface SpeedtestResult {
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  server: string | null;
  timestamp: number;
}

const BASE = "https://speed.cloudflare.com";
const TIMEOUT = 30_000;

/** Measure latency: median of N small requests to /__down?bytes=1 */
export async function measurePing(samples = 5): Promise<number> {
  const latencies: number[] = [];
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    try {
      await fetch(`${BASE}/__down?bytes=1`, { signal: AbortSignal.timeout(5000) });
      latencies.push(performance.now() - start);
    } catch { /* skip failed sample */ }
  }
  if (latencies.length === 0) return 0;
  latencies.sort((a, b) => a - b);
  return latencies[Math.floor(latencies.length / 2)] ?? latencies[0] ?? 0;
}

/** Measure download speed by fetching `bytes` from Cloudflare and consuming the body */
export async function measureDownload(bytes: number): Promise<number> {
  const start = performance.now();
  const res = await fetch(`${BASE}/__down?bytes=${bytes}`, {
    signal: AbortSignal.timeout(TIMEOUT),
  });
  await res.arrayBuffer();
  const elapsedSec = (performance.now() - start) / 1000;
  return (bytes * 8) / elapsedSec / 1_000_000;
}

/** Measure upload speed by POSTing `bytes` of zeros to Cloudflare */
export async function measureUpload(bytes: number): Promise<number> {
  const body = new Uint8Array(bytes);
  const start = performance.now();
  await fetch(`${BASE}/__up`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const elapsedSec = (performance.now() - start) / 1000;
  return (bytes * 8) / elapsedSec / 1_000_000;
}

export async function runSpeedtest(): Promise<SpeedtestResult> {
  const ts = now();
  console.log("[speedtest] Starting speed test via speed.cloudflare.com...");

  const pingMs = await measurePing(5);

  // Download: two runs of 25 MB each, take average
  const dl1 = await measureDownload(25_000_000);
  const dl2 = await measureDownload(25_000_000);
  const downloadMbps = (dl1 + dl2) / 2;

  // Upload: two runs of 10 MB each, take average
  const ul1 = await measureUpload(10_000_000);
  const ul2 = await measureUpload(10_000_000);
  const uploadMbps = (ul1 + ul2) / 2;

  const server = "Cloudflare (speed.cloudflare.com)";

  console.log(
    `[speedtest] Done: ↓${downloadMbps.toFixed(1)} ↑${uploadMbps.toFixed(1)} Mbps, ping ${pingMs.toFixed(0)}ms`
  );

  await db.insert(speedtestResults).values({
    downloadMbps,
    uploadMbps,
    pingMs,
    server,
    timestamp: ts,
  });

  return { downloadMbps, uploadMbps, pingMs, server, timestamp: ts };
}
