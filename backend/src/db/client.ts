import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema.ts";

const DB_PATH = process.env["DB_PATH"] ?? "/app/data/monitor.db";

const sqlite = new Database(DB_PATH, { create: true });
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA synchronous = NORMAL;");

export const db = drizzle(sqlite, { schema });

export function initDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ping_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target TEXT NOT NULL,
      target_label TEXT NOT NULL,
      status TEXT NOT NULL,
      rtt_ms REAL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dns_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server TEXT NOT NULL,
      server_label TEXT NOT NULL,
      domain TEXT NOT NULL,
      status TEXT NOT NULL,
      latency_ms REAL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS http_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      status_code INTEGER,
      latency_ms REAL,
      error TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS traceroute_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target TEXT NOT NULL,
      hops TEXT NOT NULL,
      routing_changed INTEGER NOT NULL DEFAULT 0,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS speedtest_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      download_mbps REAL NOT NULL,
      upload_mbps REAL NOT NULL,
      ping_ms REAL NOT NULL,
      server TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS public_ip_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ipv4 TEXT,
      ipv6 TEXT,
      changed INTEGER NOT NULL DEFAULT 0,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS network_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      interface TEXT NOT NULL,
      rx_bytes INTEGER NOT NULL,
      tx_bytes INTEGER NOT NULL,
      rx_errors INTEGER NOT NULL,
      tx_errors INTEGER NOT NULL,
      rx_dropped INTEGER NOT NULL,
      tx_dropped INTEGER NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ssl_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host TEXT NOT NULL,
      expires_at INTEGER,
      days_remaining INTEGER,
      status TEXT NOT NULL,
      error TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS misc_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      value TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS interface_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      interface_name TEXT NOT NULL,
      status TEXT NOT NULL,
      ipv4 TEXT,
      ipv6_link_local TEXT,
      gateway_ip TEXT,
      gateway_mac TEXT,
      connection_type TEXT,
      rx_errors INTEGER NOT NULL DEFAULT 0,
      tx_errors INTEGER NOT NULL DEFAULT 0,
      rx_dropped INTEGER NOT NULL DEFAULT 0,
      tx_dropped INTEGER NOT NULL DEFAULT 0,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tcp_connect_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host TEXT NOT NULL DEFAULT '1.1.1.1',
      port INTEGER NOT NULL DEFAULT 443,
      status TEXT NOT NULL,
      latency_ms REAL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dns_extra_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consistency TEXT NOT NULL,
      nxdomain TEXT NOT NULL,
      hijacking TEXT NOT NULL,
      doh TEXT NOT NULL,
      dns_leak TEXT NOT NULL DEFAULT 'unknown',
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS captive_portal_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS http_redirect_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ntp_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      drift_ms INTEGER,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS os_resolver_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      nameservers TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ping_results_target_ts ON ping_results(target, timestamp);
    CREATE INDEX IF NOT EXISTS idx_dns_results_server_ts ON dns_results(server, timestamp);
    CREATE INDEX IF NOT EXISTS idx_http_results_url_ts ON http_results(url, timestamp);
    CREATE INDEX IF NOT EXISTS idx_traceroute_ts ON traceroute_results(timestamp);
    CREATE INDEX IF NOT EXISTS idx_speedtest_ts ON speedtest_results(timestamp);
    CREATE INDEX IF NOT EXISTS idx_public_ip_ts ON public_ip_events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_network_stats_ts ON network_stats(interface, timestamp);
    CREATE INDEX IF NOT EXISTS idx_ssl_checks_host_ts ON ssl_checks(host, timestamp);
    CREATE INDEX IF NOT EXISTS idx_misc_checks_type_ts ON misc_checks(type, timestamp);
    CREATE INDEX IF NOT EXISTS idx_interface_checks_ts ON interface_checks(timestamp);
    CREATE INDEX IF NOT EXISTS idx_tcp_connect_ts ON tcp_connect_results(timestamp);
    CREATE INDEX IF NOT EXISTS idx_dns_extra_ts ON dns_extra_checks(timestamp);
    CREATE INDEX IF NOT EXISTS idx_captive_portal_ts ON captive_portal_checks(timestamp);
    CREATE INDEX IF NOT EXISTS idx_http_redirect_ts ON http_redirect_checks(timestamp);
    CREATE INDEX IF NOT EXISTS idx_ntp_checks_ts ON ntp_checks(timestamp);
    CREATE INDEX IF NOT EXISTS idx_os_resolver_ts ON os_resolver_checks(timestamp);
  `);

  // Migration: add has_black_hole column to traceroute_results if it doesn't exist yet
  try {
    sqlite.exec(`ALTER TABLE traceroute_results ADD COLUMN has_black_hole INTEGER NOT NULL DEFAULT 0;`);
  } catch {
    // Column already exists — safe to ignore
  }

  console.log(`[DB] Initialized at ${DB_PATH}`);
}
