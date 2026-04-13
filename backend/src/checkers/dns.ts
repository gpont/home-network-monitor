import { db } from "../db/client.ts";
import { dnsResults, dnsExtraChecks } from "../db/schema.ts";
import { spawn, now } from "./utils.ts";
import { parseResolvConf } from "./system.ts";

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

export interface DnsAnswerResult {
  status: "ok" | "timeout" | "servfail" | "error";
  answer: string | null;
}

export function checkDnsConsistency(results: DnsAnswerResult[], validAnswers?: Set<string>): "ok" | "mismatch" | "unknown" {
  const okResults = results.filter(r => r.status === "ok" && r.answer !== null);
  if (okResults.length === 0) return "unknown";
  if (validAnswers) {
    // All ok answers must be within the known-valid set for this domain.
    // Catches hijacking while tolerating legitimate anycast IPs (e.g. one.one.one.one → 1.1.1.1 or 1.0.0.1).
    return okResults.every(r => validAnswers.has(r.answer!)) ? "ok" : "mismatch";
  }
  const answers = new Set(okResults.map(r => r.answer));
  return answers.size === 1 ? "ok" : "mismatch";
}

export function checkNxdomain(digOutput: string): "ok" | "fail" {
  return digOutput.includes("NXDOMAIN") ? "ok" : "fail";
}

function isPrivateIp(ip: string): boolean {
  return ip.startsWith("10.") ||
    ip.startsWith("172.16.") || ip.startsWith("172.17.") || ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") || ip.startsWith("172.20.") || ip.startsWith("172.21.") ||
    ip.startsWith("172.22.") || ip.startsWith("172.23.") || ip.startsWith("172.24.") ||
    ip.startsWith("172.25.") || ip.startsWith("172.26.") || ip.startsWith("172.27.") ||
    ip.startsWith("172.28.") || ip.startsWith("172.29.") || ip.startsWith("172.30.") ||
    ip.startsWith("172.31.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("127.") ||
    ip === "::1" ||
    ip.startsWith("169.254.");
}

/** Detects DNS leaks by comparing OS nameservers against configured DNS servers.
 *  - Loopback/link-local: always "unknown" (local resolver like dnsmasq/unbound/Docker)
 *  - Private RFC1918 not in configured list: "unknown" (container/VM resolver, can't inspect)
 *  - Public IP not in configured list: "leak" (actual DNS leak to ISP or unknown server)
 */
export function checkDnsLeak(osNameservers: string[], configuredServers: string[]): "ok" | "leak" | "unknown" {
  const configured = new Set(configuredServers);
  // Only consider nameservers that aren't loopback/link-local
  const nonLocal = osNameservers.filter(ns => !ns.startsWith("127.") && ns !== "::1" && !ns.startsWith("169.254."));
  if (nonLocal.length === 0) return "unknown";
  // Check if any nameserver is a public IP not in configured list
  const hasPublicLeak = nonLocal.some(ns => !isPrivateIp(ns) && !configured.has(ns));
  if (hasPublicLeak) return "leak";
  // All non-loopback nameservers are either configured or private (container/local resolver)
  const allConfiguredOrPrivate = nonLocal.every(ns => configured.has(ns) || isPrivateIp(ns));
  if (allConfiguredOrPrivate) {
    return nonLocal.every(ns => configured.has(ns)) ? "ok" : "unknown";
  }
  return "unknown";
}

// one.one.one.one has two valid IPs: 1.1.1.1 and 1.0.0.1
const CLOUDFLARE_ONE_IPS = new Set(["1.1.1.1", "1.0.0.1"]);

export function checkHijacking(answer: string | null): "ok" | "hijacked" | "unknown" {
  if (!answer) return "unknown";
  return CLOUDFLARE_ONE_IPS.has(answer) ? "ok" : "hijacked";
}

async function queryDns(server: string, domain: string): Promise<string | null> {
  const result = await spawn(["dig", "+short", "+time=3", "+tries=1", `@${server}`, domain, "A"], 5000);
  const lines = result.stdout.trim().split("\n").filter(l => /^\d+\.\d+\.\d+\.\d+$/.test(l));
  return lines[0] ?? null;
}

async function checkDoH(): Promise<"ok" | "fail" | "unknown"> {
  try {
    const res = await fetch("https://cloudflare-dns.com/dns-query?name=one.one.one.one&type=A", {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return "fail";
    const json = await res.json() as { Answer?: Array<{ data: string }> };
    return json.Answer && json.Answer.length > 0 ? "ok" : "fail";
  } catch {
    return "unknown";
  }
}

export async function checkDnsExtras(servers: Array<{ ip: string; label: string }>) {
  const timestamp = Date.now();

  // Query one.one.one.one from all resolvers
  const answers = await Promise.all(
    servers.map(async s => {
      const answer = await queryDns(s.ip, "one.one.one.one").catch(() => null);
      return { status: answer ? "ok" as const : "timeout" as const, answer };
    })
  );

  const consistency = checkDnsConsistency(answers, CLOUDFLARE_ONE_IPS);
  const hijacking = checkHijacking(answers[0]?.answer ?? null);

  // NXDOMAIN check
  const randomDomain = `nxcheck-${Date.now()}.invalid`;
  const nxOut = await spawn(["dig", "+time=3", "+tries=1", "@8.8.8.8", randomDomain, "A"], 5000).catch(() => ({ stdout: "" }));
  const nxdomain = checkNxdomain(nxOut.stdout);

  const doh = await checkDoH();

  // DNS leak: compare OS resolver against configured DNS servers
  let dnsLeak: "ok" | "leak" | "unknown" = "unknown";
  try {
    const resolvConf = await Bun.file("/etc/resolv.conf").text();
    const osNameservers = parseResolvConf(resolvConf);
    dnsLeak = checkDnsLeak(osNameservers, servers.map(s => s.ip));
  } catch { /* /etc/resolv.conf unavailable */ }

  await db.insert(dnsExtraChecks).values({
    consistency,
    nxdomain,
    hijacking,
    doh,
    dnsLeak,
    timestamp,
  });

  return { consistency, nxdomain, hijacking, doh, dnsLeak, timestamp };
}
