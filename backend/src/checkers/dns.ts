import { db } from "../db/client.ts";
import { dnsResults } from "../db/schema.ts";
import { spawn, now } from "./utils.ts";

export interface DnsServer {
  ip: string;
  label: string;
}

export interface DnsResult {
  server: string;
  serverLabel: string;
  domain: string;
  status: "ok" | "timeout" | "servfail" | "error";
  latencyMs: number | null;
  timestamp: number;
}

export async function checkDns(
  server: DnsServer,
  domain = "google.com"
): Promise<DnsResult> {
  const ts = now();
  const start = performance.now();

  const result = await spawn(
    ["dig", "+time=3", "+tries=1", `@${server.ip}`, domain, "A"],
    5000
  );

  const latencyMs = performance.now() - start;

  if (result.exitCode === -1 || result.stderr === "timeout") {
    return {
      server: server.ip,
      serverLabel: server.label,
      domain,
      status: "timeout",
      latencyMs: null,
      timestamp: ts,
    };
  }

  if (result.stdout.includes("SERVFAIL")) {
    return {
      server: server.ip,
      serverLabel: server.label,
      domain,
      status: "servfail",
      latencyMs,
      timestamp: ts,
    };
  }

  if (result.stdout.includes("NOERROR") && result.stdout.includes("ANSWER SECTION")) {
    // Parse query time from dig output: ";; Query time: 12 msec"
    const digTimeMatch = result.stdout.match(/Query time: (\d+) msec/);
    const measuredMs = digTimeMatch?.[1] ? parseInt(digTimeMatch[1]) : latencyMs;

    return {
      server: server.ip,
      serverLabel: server.label,
      domain,
      status: "ok",
      latencyMs: measuredMs,
      timestamp: ts,
    };
  }

  return {
    server: server.ip,
    serverLabel: server.label,
    domain,
    status: "error",
    latencyMs: null,
    timestamp: ts,
  };
}

export async function runDnsChecks(
  servers: DnsServer[],
  domain = "google.com"
): Promise<DnsResult[]> {
  const results = await Promise.all(servers.map((s) => checkDns(s, domain)));

  await db.insert(dnsResults).values(
    results.map((r) => ({
      server: r.server,
      serverLabel: r.serverLabel,
      domain: r.domain,
      status: r.status,
      latencyMs: r.latencyMs,
      timestamp: r.timestamp,
    }))
  );

  return results;
}
