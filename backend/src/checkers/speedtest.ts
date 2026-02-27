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

export async function runSpeedtest(): Promise<SpeedtestResult> {
  const ts = now();

  console.log("[speedtest] Starting speed test...");

  // Dynamic import to avoid loading at startup
  const speedtest = await import("speedtest-net");
  const st = speedtest.default ?? speedtest;

  const result = await st({
    acceptLicense: true,
    acceptGdpr: true,
  });

  const downloadMbps = result.download.bandwidth / 125000; // bytes/s to Mbps
  const uploadMbps = result.upload.bandwidth / 125000;
  const pingMs = result.ping.latency;
  const server = result.server ? `${result.server.name} (${result.server.location})` : null;

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
