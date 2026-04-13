import { db } from "../db/client.ts";
import { httpResults, captivePortalChecks, httpRedirectChecks } from "../db/schema.ts";
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

export function parseCaptivePortalResponse(status: number, body: string): "clean" | "detected" {
  // Firefox captive portal URL returns plain text "success" when clean
  return status === 200 && body.trim() === "success" ? "clean" : "detected";
}

export function parseRedirectResponse(finalUrl: string): "ok" | "intercepted" {
  // If we followed redirects and ended up at https:// — redirect chain is clean
  return finalUrl.startsWith("https://") ? "ok" : "intercepted";
}

export async function checkCaptivePortal(): Promise<{ status: "clean" | "detected" | "error" }> {
  const timestamp = Date.now();
  try {
    // Firefox detectportal returns plain text "success" (200) when clean
    const res = await fetch("http://detectportal.firefox.com/", {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.text();
    const status = parseCaptivePortalResponse(res.status, body);
    await db.insert(captivePortalChecks).values({ status, timestamp });
    return { status };
  } catch {
    await db.insert(captivePortalChecks).values({ status: "error", timestamp });
    return { status: "error" };
  }
}

export async function checkHttpRedirect(): Promise<{ status: "ok" | "intercepted" | "error" }> {
  const timestamp = Date.now();
  try {
    // github.com reliably returns 301 → https:// (unlike google.com which serves HTTP directly)
    const res = await fetch("http://github.com", {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    const finalUrl = res.url || "";
    const status = parseRedirectResponse(finalUrl);
    await db.insert(httpRedirectChecks).values({ status, timestamp });
    return { status };
  } catch {
    await db.insert(httpRedirectChecks).values({ status: "error", timestamp });
    return { status: "error" };
  }
}
