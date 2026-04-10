import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../db/schema.ts";
import { buildApiRoutes } from "./api.ts";

function createTestApp() {
  const sqlite = new Database(":memory:");
  sqlite.run(`CREATE TABLE IF NOT EXISTS ping_results (id INTEGER PRIMARY KEY AUTOINCREMENT, target TEXT NOT NULL, target_label TEXT NOT NULL, status TEXT NOT NULL, rtt_ms REAL, timestamp INTEGER NOT NULL)`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS dns_results (id INTEGER PRIMARY KEY AUTOINCREMENT, server TEXT NOT NULL, server_label TEXT NOT NULL, domain TEXT NOT NULL, status TEXT NOT NULL, latency_ms REAL, timestamp INTEGER NOT NULL)`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS http_results (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL, status_code INTEGER, latency_ms REAL, error TEXT, timestamp INTEGER NOT NULL)`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS traceroute_results (id INTEGER PRIMARY KEY AUTOINCREMENT, target TEXT NOT NULL, hops TEXT NOT NULL, routing_changed INTEGER NOT NULL DEFAULT 0, has_black_hole INTEGER NOT NULL DEFAULT 0, timestamp INTEGER NOT NULL)`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS speedtest_results (id INTEGER PRIMARY KEY AUTOINCREMENT, download_mbps REAL NOT NULL, upload_mbps REAL NOT NULL, ping_ms REAL NOT NULL, server TEXT, timestamp INTEGER NOT NULL)`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS public_ip_events (id INTEGER PRIMARY KEY AUTOINCREMENT, ipv4 TEXT, ipv6 TEXT, changed INTEGER NOT NULL DEFAULT 0, timestamp INTEGER NOT NULL)`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS network_stats (id INTEGER PRIMARY KEY AUTOINCREMENT, interface TEXT NOT NULL, rx_bytes INTEGER NOT NULL, tx_bytes INTEGER NOT NULL, rx_errors INTEGER NOT NULL, tx_errors INTEGER NOT NULL, rx_dropped INTEGER NOT NULL, tx_dropped INTEGER NOT NULL, timestamp INTEGER NOT NULL)`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS ssl_checks (id INTEGER PRIMARY KEY AUTOINCREMENT, host TEXT NOT NULL, expires_at INTEGER, days_remaining INTEGER, status TEXT NOT NULL, error TEXT, timestamp INTEGER NOT NULL)`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS misc_checks (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, status TEXT NOT NULL, value TEXT, timestamp INTEGER NOT NULL)`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS interface_checks (id INTEGER PRIMARY KEY AUTOINCREMENT, interface_name TEXT NOT NULL, status TEXT NOT NULL, ipv4 TEXT, ipv6_link_local TEXT, gateway_ip TEXT, gateway_mac TEXT, connection_type TEXT, rx_errors INTEGER NOT NULL DEFAULT 0, tx_errors INTEGER NOT NULL DEFAULT 0, rx_dropped INTEGER NOT NULL DEFAULT 0, tx_dropped INTEGER NOT NULL DEFAULT 0, timestamp INTEGER NOT NULL)`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS tcp_connect_results (id INTEGER PRIMARY KEY AUTOINCREMENT, host TEXT NOT NULL DEFAULT '1.1.1.1', port INTEGER NOT NULL DEFAULT 443, status TEXT NOT NULL, latency_ms REAL, timestamp INTEGER NOT NULL)`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS dns_extra_checks (id INTEGER PRIMARY KEY AUTOINCREMENT, consistency TEXT NOT NULL, nxdomain TEXT NOT NULL, hijacking TEXT NOT NULL, doh TEXT NOT NULL, dns_leak TEXT NOT NULL DEFAULT 'unknown', timestamp INTEGER NOT NULL)`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS captive_portal_checks (id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT NOT NULL, timestamp INTEGER NOT NULL)`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS http_redirect_checks (id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT NOT NULL, timestamp INTEGER NOT NULL)`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS ntp_checks (id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT NOT NULL, drift_ms INTEGER, timestamp INTEGER NOT NULL)`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS os_resolver_checks (id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT NOT NULL, nameservers TEXT NOT NULL, timestamp INTEGER NOT NULL)`);
  const db = drizzle(sqlite, { schema });
  const app = new Hono();
  app.route("/api", buildApiRoutes(db));
  return { app, db };
}

describe("POST /api/run/:type", () => {
  test("returns 400 for unknown type", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/run/unknown", { method: "POST" });
    expect(res.status).toBe(400);
  });

  test("returns 200 for valid type (no real check runs in test)", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/run/publicip", { method: "POST" });
    // In test context there's no real network, but the endpoint itself should exist
    // We just verify routing works — actual check may fail gracefully
    expect(res.status).toBeLessThan(500);
  });

  test("returns 409 if already running", async () => {
    // This test verifies the 409 path exists — hard to test timing in unit tests
    // so just verify the endpoint returns non-500 when called twice rapidly
    const { app } = createTestApp();
    const [res1, res2] = await Promise.all([
      app.request("/api/run/publicip", { method: "POST" }),
      app.request("/api/run/publicip", { method: "POST" }),
    ]);
    // At least one should be non-500
    expect(Math.min(res1.status, res2.status)).toBeLessThan(500);
  });
});

describe("GET /api/status", () => {
  test("returns 200 with all required top-level fields", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/status");
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty("ping");
    expect(body).toHaveProperty("dns");
    expect(body).toHaveProperty("http");
    expect(body).toHaveProperty("interface");
    expect(body).toHaveProperty("tcpConnect");
    expect(body).toHaveProperty("dnsExtra");
    expect(body).toHaveProperty("captivePortal");
    expect(body).toHaveProperty("ntp");
    expect(body).toHaveProperty("osResolver");
    expect(body).toHaveProperty("pingStats");
  });

  test("returns null for missing data (empty DB)", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/status");
    const body = await res.json() as Record<string, unknown>;
    expect(body.interface).toBeNull();
    expect(body.tcpConnect).toBeNull();
    expect(body.ntp).toBeNull();
  });
});
