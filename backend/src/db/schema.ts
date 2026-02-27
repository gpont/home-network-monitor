import { sqliteTable, integer, real, text } from "drizzle-orm/sqlite-core";

// Raw ping results — one row per individual ping
export const pingResults = sqliteTable("ping_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  target: text("target").notNull(), // 'router', '8.8.8.8', etc.
  targetLabel: text("target_label").notNull(), // Human-readable label
  status: text("status", { enum: ["ok", "timeout", "error"] }).notNull(),
  rttMs: real("rtt_ms"), // null on timeout/error
  timestamp: integer("timestamp").notNull(), // Unix ms
});

// DNS check results
export const dnsResults = sqliteTable("dns_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  server: text("server").notNull(), // '8.8.8.8', 'local', '1.1.1.1'
  serverLabel: text("server_label").notNull(),
  domain: text("domain").notNull(),
  status: text("status", { enum: ["ok", "timeout", "servfail", "error"] }).notNull(),
  latencyMs: real("latency_ms"),
  timestamp: integer("timestamp").notNull(),
});

// HTTP check results
export const httpResults = sqliteTable("http_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull(),
  statusCode: integer("status_code"),
  latencyMs: real("latency_ms"),
  error: text("error"),
  timestamp: integer("timestamp").notNull(),
});

// Traceroute snapshots
export const tracerouteResults = sqliteTable("traceroute_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  target: text("target").notNull(),
  hops: text("hops").notNull(), // JSON: [{hop: 1, ip: '...', rttMs: 12.3}]
  routingChanged: integer("routing_changed", { mode: "boolean" }).notNull().default(false),
  timestamp: integer("timestamp").notNull(),
});

// Speedtest results
export const speedtestResults = sqliteTable("speedtest_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  downloadMbps: real("download_mbps").notNull(),
  uploadMbps: real("upload_mbps").notNull(),
  pingMs: real("ping_ms").notNull(),
  server: text("server"),
  timestamp: integer("timestamp").notNull(),
});

// Public IP change events
export const publicIpEvents = sqliteTable("public_ip_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ipv4: text("ipv4"),
  ipv6: text("ipv6"),
  changed: integer("changed", { mode: "boolean" }).notNull().default(false),
  timestamp: integer("timestamp").notNull(),
});

// Network interface stats (from /proc/net/dev)
export const networkStats = sqliteTable("network_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  interface: text("interface").notNull(),
  rxBytes: integer("rx_bytes").notNull(),
  txBytes: integer("tx_bytes").notNull(),
  rxErrors: integer("rx_errors").notNull(),
  txErrors: integer("tx_errors").notNull(),
  rxDropped: integer("rx_dropped").notNull(),
  txDropped: integer("tx_dropped").notNull(),
  timestamp: integer("timestamp").notNull(),
});

// SSL certificate checks
export const sslChecks = sqliteTable("ssl_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  host: text("host").notNull(),
  expiresAt: integer("expires_at"), // Unix ms
  daysRemaining: integer("days_remaining"),
  status: text("status", { enum: ["ok", "warning", "expired", "error"] }).notNull(),
  error: text("error"),
  timestamp: integer("timestamp").notNull(),
});

// Misc checks: CGNAT, MTU, DHCP/PPPoE, IPv6
export const miscChecks = sqliteTable("misc_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["cgnat", "mtu", "dhcp", "ipv6"] }).notNull(),
  status: text("status").notNull(),
  value: text("value"), // JSON with extra details
  timestamp: integer("timestamp").notNull(),
});
