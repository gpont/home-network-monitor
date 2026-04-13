import type { Config } from "./config.ts";
import { detectGateway, runPingChecks, runTcpConnectCheck } from "./checkers/ping.ts";
import { runDnsChecks, checkDnsExtras } from "./checkers/dns.ts";
import { parseResolvConf } from "./checkers/system.ts";
import { runHttpChecks, checkCaptivePortal, checkHttpRedirect } from "./checkers/http.ts";
import { runTraceroute, extractIspHop } from "./checkers/traceroute.ts";
import { runSpeedtest } from "./checkers/speedtest.ts";
import { checkPublicIp, loadLastIp } from "./checkers/publicip.ts";
import {
  checkCgnat,
  checkMtu,
  checkIpv6,
  checkDhcp,
  checkNetworkStats,
  checkSslCert,
} from "./checkers/misc.ts";
import { checkInterface } from "./checkers/interface.ts";
import { checkSystem } from "./checkers/system.ts";
import { scheduleCleanup } from "./db/cleanup.ts";
import { db } from "./db/client.ts";

type BroadcastFn = (event: string, data: unknown) => void;

let gatewayIp: string | null = null;
let ispHopIp: string | null = null;
let osResolverIp: string | null = null;

export async function startScheduler(config: Config, broadcast: BroadcastFn) {
  console.log("[scheduler] Starting...");

  scheduleCleanup(db);

  await loadLastIp();

  // Detect gateway and OS resolver once at startup
  [gatewayIp, osResolverIp] = await Promise.all([
    detectGateway(),
    detectOsResolver(),
  ]);
  if (gatewayIp) {
    console.log(`[scheduler] Gateway detected: ${gatewayIp}`);
  } else {
    console.warn("[scheduler] Could not detect gateway, skipping router ping");
  }
  if (osResolverIp) {
    console.log(`[scheduler] OS resolver detected: ${osResolverIp}`);
  }

  // Build resolved target lists
  const pingTargets = buildPingTargets(config, gatewayIp, ispHopIp);
  const dnsServers = buildDnsServers(config, gatewayIp, osResolverIp);

  // Run everything immediately on startup
  await runAll(config, pingTargets, dnsServers, broadcast);

  // Then schedule recurring checks
  scheduleInterval("ping", config.intervals.ping, async () => {
    const targets = buildPingTargets(config, gatewayIp, ispHopIp);
    const results = await runPingChecks(targets);
    broadcast("ping", results);
  });

  scheduleInterval("dns", config.intervals.dns, async () => {
    const servers = buildDnsServers(config, gatewayIp, osResolverIp);
    const results = await runDnsChecks(servers);
    broadcast("dns", results);
  });

  scheduleInterval("http", config.intervals.http, async () => {
    const results = await runHttpChecks(config.httpTargets);
    broadcast("http", results);
  });

  scheduleInterval("traceroute", config.intervals.traceroute, async () => {
    const result = await runTraceroute("8.8.8.8");
    ispHopIp = extractIspHop(result.hops);
    broadcast("traceroute", result);
  });

  scheduleInterval("speedtest", config.intervals.speedtest, async () => {
    const result = await runSpeedtest();
    broadcast("speedtest", result);
  });

  scheduleInterval("publicIp", config.intervals.publicIp, async () => {
    const result = await checkPublicIp();
    broadcast("publicIp", result);
  });

  scheduleInterval("cgnat", config.intervals.cgnat, async () => {
    const result = await checkCgnat(ispHopIp);
    broadcast("cgnat", result);
  });

  scheduleInterval("mtu", config.intervals.mtu, async () => {
    const result = await checkMtu();
    broadcast("mtu", result);
  });

  scheduleInterval("ipv6", config.intervals.ping, async () => {
    const result = await checkIpv6();
    broadcast("ipv6", result);
  });

  scheduleInterval("networkStats", config.intervals.networkStats, async () => {
    const results = await checkNetworkStats();
    broadcast("networkStats", results);
  });

  scheduleInterval("dhcp", config.intervals.dhcp, async () => {
    const result = await checkDhcp();
    broadcast("dhcp", result);
  });

  scheduleInterval("ssl", config.intervals.ssl, async () => {
    const results = await Promise.all(config.sslHosts.map(checkSslCert));
    broadcast("ssl", results);
  });

  scheduleInterval("interface", config.intervals.ping, async () => {
    const result = await checkInterface();
    broadcast("interface", result);
  });

  scheduleInterval("system", config.intervals.publicIp, async () => {
    const result = await checkSystem();
    broadcast("system", result);
  });

  scheduleInterval("tcpConnect", config.intervals.ping, async () => {
    const result = await runTcpConnectCheck("1.1.1.1", 443);
    broadcast("tcpConnect", result);
  });

  scheduleInterval("dnsExtras", config.intervals.publicIp, async () => {
    const servers = buildDnsServers(config, gatewayIp, osResolverIp);
    const result = await checkDnsExtras(servers);
    broadcast("dnsExtra", result);
  });

  scheduleInterval("captivePortal", config.intervals.http, async () => {
    const result = await checkCaptivePortal();
    broadcast("captivePortal", result);
  });

  scheduleInterval("httpRedirect", config.intervals.http, async () => {
    const result = await checkHttpRedirect();
    broadcast("httpRedirect", result);
  });
}

async function runAll(
  config: Config,
  pingTargets: ReturnType<typeof buildPingTargets>,
  dnsServers: ReturnType<typeof buildDnsServers>,
  broadcast: BroadcastFn
) {
  const checks = [
    runPingChecks(pingTargets).then((r) => broadcast("ping", r)),
    runDnsChecks(dnsServers).then((r) => broadcast("dns", r)),
    runHttpChecks(config.httpTargets).then((r) => broadcast("http", r)),
    checkPublicIp().then((r) => broadcast("publicIp", r)),
    checkIpv6().then((r) => broadcast("ipv6", r)),
    checkNetworkStats().then((r) => broadcast("networkStats", r)),
    checkDhcp().then((r) => broadcast("dhcp", r)),
    checkInterface().then((r) => broadcast("interface", r)),
    checkSystem().then((r) => broadcast("system", r)),
    runTcpConnectCheck("1.1.1.1", 443).then((r) => broadcast("tcpConnect", r)),
    checkCaptivePortal().then((r) => broadcast("captivePortal", r)),
    checkHttpRedirect().then((r) => broadcast("httpRedirect", r)),
  ];

  await Promise.allSettled(checks);

  // Traceroute needs to run first to detect ISP hop
  const trResult = await runTraceroute("8.8.8.8").catch(() => null);
  if (trResult) {
    ispHopIp = extractIspHop(trResult.hops);
    broadcast("traceroute", trResult);
    await checkCgnat(ispHopIp).then((r) => broadcast("cgnat", r));
  }

  // DNS extras after traceroute so gateway IP is available
  await checkDnsExtras(dnsServers).then((r) => broadcast("dnsExtra", r)).catch(() => {});

  // Slower checks — run async, don't block startup
  Promise.all(config.sslHosts.map(checkSslCert)).then((r) => broadcast("ssl", r));
  checkMtu().then((r) => broadcast("mtu", r));
  runSpeedtest().then((r) => broadcast("speedtest", r)).catch(() => {});
}

function scheduleInterval(name: string, intervalMs: number, fn: () => Promise<void>) {
  const run = async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`[scheduler] ${name} error:`, err);
    }
  };

  setInterval(run, intervalMs);
  console.log(`[scheduler] ${name} scheduled every ${intervalMs / 1000}s`);
}

function buildPingTargets(
  config: Config,
  gateway: string | null,
  ispHop: string | null
) {
  return config.pingTargets
    .map((t) => {
      if (t.host === "GATEWAY_PLACEHOLDER") {
        if (!gateway) return null;
        return { ...t, host: gateway };
      }
      if (t.host === "ISP_HOP_PLACEHOLDER") {
        if (!ispHop) return null;
        return { ...t, host: ispHop };
      }
      return t;
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);
}

function buildDnsServers(
  config: Config,
  gateway: string | null,
  osResolver: string | null
) {
  return config.dnsServers
    .map((s) => {
      if (s.ip === "GATEWAY_PLACEHOLDER") {
        // Prefer the OS resolver from /etc/resolv.conf — it's the actual DNS in use.
        // Falls back to gateway if no external resolver found (e.g. systemd-resolved on 127.0.0.53).
        const ip = osResolver ?? gateway;
        if (!ip) return null;
        return { ...s, ip };
      }
      return s;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
}

async function detectOsResolver(): Promise<string | null> {
  try {
    const content = await Bun.file("/etc/resolv.conf").text();
    const nameservers = parseResolvConf(content);
    // Use first non-loopback, non-link-local nameserver — that's the actual DNS resolver
    return nameservers.find(ns =>
      !ns.startsWith("127.") && ns !== "::1" && !ns.startsWith("169.254.")
    ) ?? null;
  } catch {
    return null;
  }
}
