import type { Config } from "./config.ts";
import { detectGateway, runPingChecks } from "./checkers/ping.ts";
import { runDnsChecks } from "./checkers/dns.ts";
import { runHttpChecks } from "./checkers/http.ts";
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

type BroadcastFn = (event: string, data: unknown) => void;

let gatewayIp: string | null = null;
let ispHopIp: string | null = null;

export async function startScheduler(config: Config, broadcast: BroadcastFn) {
  console.log("[scheduler] Starting...");

  await loadLastIp();

  // Detect gateway once at startup
  gatewayIp = await detectGateway();
  if (gatewayIp) {
    console.log(`[scheduler] Gateway detected: ${gatewayIp}`);
  } else {
    console.warn("[scheduler] Could not detect gateway, skipping router ping");
  }

  // Build resolved target lists
  const pingTargets = buildPingTargets(config, gatewayIp, ispHopIp);
  const dnsServers = buildDnsServers(config, gatewayIp);

  // Run everything immediately on startup
  await runAll(config, pingTargets, dnsServers, broadcast);

  // Then schedule recurring checks
  scheduleInterval("ping", config.intervals.ping, async () => {
    const targets = buildPingTargets(config, gatewayIp, ispHopIp);
    const results = await runPingChecks(targets);
    broadcast("ping", results);
  });

  scheduleInterval("dns", config.intervals.dns, async () => {
    const servers = buildDnsServers(config, gatewayIp);
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
  ];

  await Promise.allSettled(checks);

  // Traceroute needs to run first to detect ISP hop
  const trResult = await runTraceroute("8.8.8.8").catch(() => null);
  if (trResult) {
    ispHopIp = extractIspHop(trResult.hops);
    broadcast("traceroute", trResult);
    await checkCgnat(ispHopIp).then((r) => broadcast("cgnat", r));
  }

  // SSL and MTU are slower, run async
  Promise.all(config.sslHosts.map(checkSslCert)).then((r) => broadcast("ssl", r));
  checkMtu().then((r) => broadcast("mtu", r));
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
  gateway: string | null
) {
  return config.dnsServers
    .map((s) => {
      if (s.ip === "GATEWAY_PLACEHOLDER") {
        if (!gateway) return null;
        return { ...s, ip: gateway };
      }
      return s;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
}
