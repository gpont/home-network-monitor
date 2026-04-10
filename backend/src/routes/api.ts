import { Hono } from "hono";
import { db as globalDb } from "../db/client.ts";
import {
  pingResults,
  dnsResults,
  httpResults,
  tracerouteResults,
  speedtestResults,
  publicIpEvents,
  networkStats,
  sslChecks,
  miscChecks,
  interfaceChecks,
  tcpConnectResults,
  dnsExtraChecks,
  captivePortalChecks,
  ntpChecks,
  osResolverChecks,
} from "../db/schema.ts";
import { desc, gte, and, eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { computePingStats } from "../checkers/ping.ts";

export function buildApiRoutes(db: BunSQLiteDatabase<any>) {
  const router = new Hono();

  const sinceMs = (minutes: number) => Date.now() - minutes * 60_000;

  // ─── /api/status ────────────────────────────────────────────────────────────
  // Returns the latest result of every check type — for the main dashboard
  router.get("/status", async (c) => {
    const [
      latestPings,
      latestDns,
      latestHttp,
      latestTraceroute,
      latestSpeedtest,
      latestIp,
      latestCgnat,
      latestMtu,
      latestIpv6,
      latestDhcp,
      latestSsl,
      latestNetStats,
      latestInterface,
      latestTcpConnect,
      latestDnsExtra,
      latestCaptivePortal,
      latestNtp,
      latestOsResolver,
      recentPings,
    ] = await Promise.all([
      // Latest ping per target
      db
        .select()
        .from(pingResults)
        .where(gte(pingResults.timestamp, sinceMs(5)))
        .orderBy(desc(pingResults.timestamp))
        .limit(50),

      // Latest DNS per server
      db
        .select()
        .from(dnsResults)
        .where(gte(dnsResults.timestamp, sinceMs(5)))
        .orderBy(desc(dnsResults.timestamp))
        .limit(20),

      // Latest HTTP per URL
      db
        .select()
        .from(httpResults)
        .where(gte(httpResults.timestamp, sinceMs(5)))
        .orderBy(desc(httpResults.timestamp))
        .limit(20),

      // Latest traceroute
      db.select().from(tracerouteResults).orderBy(desc(tracerouteResults.timestamp)).limit(1),

      // Latest speedtest
      db.select().from(speedtestResults).orderBy(desc(speedtestResults.timestamp)).limit(1),

      // Latest public IP
      db.select().from(publicIpEvents).orderBy(desc(publicIpEvents.timestamp)).limit(1),

      // Latest CGNAT check
      db
        .select()
        .from(miscChecks)
        .where(eq(miscChecks.type, "cgnat"))
        .orderBy(desc(miscChecks.timestamp))
        .limit(1),

      // Latest MTU check
      db
        .select()
        .from(miscChecks)
        .where(eq(miscChecks.type, "mtu"))
        .orderBy(desc(miscChecks.timestamp))
        .limit(1),

      // Latest IPv6 check
      db
        .select()
        .from(miscChecks)
        .where(eq(miscChecks.type, "ipv6"))
        .orderBy(desc(miscChecks.timestamp))
        .limit(1),

      // Latest DHCP check
      db
        .select()
        .from(miscChecks)
        .where(eq(miscChecks.type, "dhcp"))
        .orderBy(desc(miscChecks.timestamp))
        .limit(1),

      // Latest SSL per host
      db
        .select()
        .from(sslChecks)
        .where(gte(sslChecks.timestamp, sinceMs(60 * 25))) // last 25 hours
        .orderBy(desc(sslChecks.timestamp))
        .limit(20),

      // Latest network stats per interface
      db
        .select()
        .from(networkStats)
        .where(gte(networkStats.timestamp, sinceMs(2)))
        .orderBy(desc(networkStats.timestamp))
        .limit(20),

      // Latest interface check
      db.select().from(interfaceChecks).orderBy(desc(interfaceChecks.timestamp)).limit(1),

      // Latest TCP connect
      db.select().from(tcpConnectResults).orderBy(desc(tcpConnectResults.timestamp)).limit(1),

      // Latest DNS extras
      db.select().from(dnsExtraChecks).orderBy(desc(dnsExtraChecks.timestamp)).limit(1),

      // Latest captive portal
      db.select().from(captivePortalChecks).orderBy(desc(captivePortalChecks.timestamp)).limit(1),

      // Latest NTP
      db.select().from(ntpChecks).orderBy(desc(ntpChecks.timestamp)).limit(1),

      // Latest OS resolver
      db.select().from(osResolverChecks).orderBy(desc(osResolverChecks.timestamp)).limit(1),

      // Recent pings for stats (last 15 min)
      db.select().from(pingResults).where(gte(pingResults.timestamp, sinceMs(15))).orderBy(desc(pingResults.timestamp)).limit(500),
    ]);

    // Deduplicate: keep latest per target/server/url/host
    const latestPerKey = <T extends { timestamp: number }>(
      rows: T[],
      keyFn: (r: T) => string
    ) => {
      const map = new Map<string, T>();
      for (const row of rows) {
        const key = keyFn(row);
        if (!map.has(key) || map.get(key)!.timestamp < row.timestamp) {
          map.set(key, row);
        }
      }
      return Array.from(map.values());
    };

    return c.json({
      ping: latestPerKey(latestPings, (r) => r.target),
      dns: latestPerKey(latestDns, (r) => r.server),
      http: latestPerKey(latestHttp, (r) => r.url),
      traceroute: latestTraceroute[0] ?? null,
      speedtest: latestSpeedtest[0] ?? null,
      publicIp: latestIp[0] ?? null,
      cgnat: latestCgnat[0] ?? null,
      mtu: latestMtu[0] ?? null,
      ipv6: latestIpv6[0] ?? null,
      dhcp: latestDhcp[0] ?? null,
      ssl: latestPerKey(latestSsl, (r) => r.host),
      networkStats: latestPerKey(latestNetStats, (r) => r.interface),
      interface: latestInterface[0] ?? null,
      tcpConnect: latestTcpConnect[0] ?? null,
      dnsExtra: latestDnsExtra[0] ?? null,
      captivePortal: latestCaptivePortal[0] ?? null,
      ntp: latestNtp[0] ?? null,
      osResolver: latestOsResolver[0]
        ? {
            ...latestOsResolver[0],
            nameservers: JSON.parse(latestOsResolver[0].nameservers),
          }
        : null,
      pingStats: computePingStats(recentPings),
    });
  });

  // ─── /api/history/ping ──────────────────────────────────────────────────────
  router.get("/history/ping", async (c) => {
    const minutes = parseInt(c.req.query("minutes") ?? "60");
    const target = c.req.query("target");

    const conditions = [gte(pingResults.timestamp, sinceMs(minutes))];
    if (target) conditions.push(eq(pingResults.target, target));

    const rows = await db
      .select()
      .from(pingResults)
      .where(and(...conditions))
      .orderBy(desc(pingResults.timestamp))
      .limit(2000);

    return c.json(rows);
  });

  // ─── /api/history/ping/stats ─────────────────────────────────────────────────
  // Aggregate: packet loss %, avg/p95 RTT per target per window
  router.get("/history/ping/stats", async (c) => {
    const windows = [5, 15, 60];
    const result: Record<string, Record<string, unknown>> = {};

    for (const minutes of windows) {
      const rows = await db
        .select()
        .from(pingResults)
        .where(gte(pingResults.timestamp, sinceMs(minutes)))
        .orderBy(desc(pingResults.timestamp));

      // Group by target
      const byTarget = new Map<string, typeof rows>();
      for (const row of rows) {
        if (!byTarget.has(row.target)) byTarget.set(row.target, []);
        byTarget.get(row.target)!.push(row);
      }

      result[`${minutes}m`] = {};
      for (const [target, targetRows] of byTarget) {
        const rtts = targetRows
          .filter((r) => r.rttMs !== null)
          .map((r) => r.rttMs as number)
          .sort((a, b) => a - b);

        const total = targetRows.length;
        const lost = targetRows.filter((r) => r.status !== "ok").length;
        const lossPercent = total > 0 ? (lost / total) * 100 : 0;

        const avg = rtts.length > 0 ? rtts.reduce((a, b) => a + b, 0) / rtts.length : null;
        const p95 = rtts.length > 0 ? rtts[Math.floor(rtts.length * 0.95)] ?? null : null;

        const mean = avg ?? 0;
        const variance =
          rtts.length > 1
            ? rtts.reduce((sum, v) => sum + (v - mean) ** 2, 0) / rtts.length
            : 0;
        const jitter = Math.sqrt(variance);

        (result[`${minutes}m`] as Record<string, unknown>)[target] = {
          lossPercent: Math.round(lossPercent * 10) / 10,
          avgRtt: avg !== null ? Math.round(avg * 10) / 10 : null,
          p95Rtt: p95 !== null ? Math.round(p95 * 10) / 10 : null,
          jitter: Math.round(jitter * 10) / 10,
          samples: total,
        };
      }
    }

    return c.json(result);
  });

  // ─── /api/history/dns ───────────────────────────────────────────────────────
  router.get("/history/dns", async (c) => {
    const minutes = parseInt(c.req.query("minutes") ?? "60");
    const rows = await db
      .select()
      .from(dnsResults)
      .where(gte(dnsResults.timestamp, sinceMs(minutes)))
      .orderBy(desc(dnsResults.timestamp))
      .limit(500);
    return c.json(rows);
  });

  // ─── /api/history/http ──────────────────────────────────────────────────────
  router.get("/history/http", async (c) => {
    const minutes = parseInt(c.req.query("minutes") ?? "60");
    const rows = await db
      .select()
      .from(httpResults)
      .where(gte(httpResults.timestamp, sinceMs(minutes)))
      .orderBy(desc(httpResults.timestamp))
      .limit(500);
    return c.json(rows);
  });

  // ─── /api/speedtest ─────────────────────────────────────────────────────────
  router.get("/speedtest", async (c) => {
    const limit = parseInt(c.req.query("limit") ?? "48"); // last 48 hours = 48 tests
    const rows = await db
      .select()
      .from(speedtestResults)
      .orderBy(desc(speedtestResults.timestamp))
      .limit(limit);
    return c.json(rows);
  });

  // ─── /api/traceroute ────────────────────────────────────────────────────────
  router.get("/traceroute", async (c) => {
    const limit = parseInt(c.req.query("limit") ?? "10");
    const rows = await db
      .select()
      .from(tracerouteResults)
      .orderBy(desc(tracerouteResults.timestamp))
      .limit(limit);
    return c.json(
      rows.map((r) => ({ ...r, hops: JSON.parse(r.hops) }))
    );
  });

  // ─── /api/events ────────────────────────────────────────────────────────────
  // Significant events: IP changes, routing changes, errors
  router.get("/events", async (c) => {
    const limit = parseInt(c.req.query("limit") ?? "50");

    const [ipChanges, routingChanges, sslWarnings] = await Promise.all([
      db
        .select()
        .from(publicIpEvents)
        .where(eq(publicIpEvents.changed, true))
        .orderBy(desc(publicIpEvents.timestamp))
        .limit(20),

      db
        .select()
        .from(tracerouteResults)
        .where(eq(tracerouteResults.routingChanged, true))
        .orderBy(desc(tracerouteResults.timestamp))
        .limit(20),

      db
        .select()
        .from(sslChecks)
        .where(and(eq(sslChecks.status, "warning")))
        .orderBy(desc(sslChecks.timestamp))
        .limit(10),
    ]);

    const events = [
      ...ipChanges.map((e) => ({
        type: "ip_change",
        message: `Public IP changed to ${e.ipv4 ?? e.ipv6}`,
        timestamp: e.timestamp,
        data: e,
      })),
      ...routingChanges.map((e) => ({
        type: "routing_change",
        message: "Network routing path changed",
        timestamp: e.timestamp,
        data: { ...e, hops: JSON.parse(e.hops) },
      })),
      ...sslWarnings.map((e) => ({
        type: "ssl_expiring",
        message: `SSL cert for ${e.host} expires in ${e.daysRemaining} days`,
        timestamp: e.timestamp,
        data: e,
      })),
    ].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);

    return c.json(events);
  });

  // ─── /api/network-stats ─────────────────────────────────────────────────────
  router.get("/network-stats", async (c) => {
    const minutes = parseInt(c.req.query("minutes") ?? "60");
    const rows = await db
      .select()
      .from(networkStats)
      .where(gte(networkStats.timestamp, sinceMs(minutes)))
      .orderBy(desc(networkStats.timestamp))
      .limit(1000);
    return c.json(rows);
  });

  // ─── /api/ssl ───────────────────────────────────────────────────────────────
  router.get("/ssl", async (c) => {
    const rows = await db
      .select()
      .from(sslChecks)
      .orderBy(desc(sslChecks.timestamp))
      .limit(50);
    return c.json(rows);
  });

  return router;
}

// Backward compat export
export const api = buildApiRoutes(globalDb);
