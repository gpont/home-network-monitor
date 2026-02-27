import { db } from "../db/client.ts";
import { httpResults } from "../db/schema.ts";
import { now } from "./utils.ts";

export interface HttpResult {
  url: string;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
  timestamp: number;
}

export async function checkHttp(url: string, timeoutMs = 10000): Promise<HttpResult> {
  const ts = now();
  const start = performance.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timer);
    const latencyMs = performance.now() - start;

    return {
      url,
      statusCode: res.status,
      latencyMs,
      error: null,
      timestamp: ts,
    };
  } catch (err) {
    const latencyMs = performance.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    const isTimeout = error.includes("abort") || error.includes("timeout");

    return {
      url,
      statusCode: null,
      latencyMs: isTimeout ? null : latencyMs,
      error: isTimeout ? "timeout" : error,
      timestamp: ts,
    };
  }
}

export async function runHttpChecks(urls: string[]): Promise<HttpResult[]> {
  const results = await Promise.all(urls.map((url) => checkHttp(url)));

  await db.insert(httpResults).values(
    results.map((r) => ({
      url: r.url,
      statusCode: r.statusCode,
      latencyMs: r.latencyMs,
      error: r.error,
      timestamp: r.timestamp,
    }))
  );

  return results;
}
