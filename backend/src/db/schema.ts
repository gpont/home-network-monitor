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
  hasBlackHole: integer("has_black_hole", { mode: "boolean" }).notNull().default(false),
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

// Network interface status checks
export const interfaceChecks = sqliteTable("interface_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  interfaceName: text("interface_name").notNull(),
  status: text("status", { enum: ["up", "down", "unknown"] }).notNull(),
  ipv4: text("ipv4"),
  ipv6LinkLocal: text("ipv6_link_local"),
  gatewayIp: text("gateway_ip"),
  gatewayMac: text("gateway_mac"),
  connectionType: text("connection_type", { enum: ["dhcp", "pppoe", "static", "unknown"] }),
  rxErrors: integer("rx_errors").notNull().default(0),
  txErrors: integer("tx_errors").notNull().default(0),
  rxDropped: integer("rx_dropped").notNull().default(0),
  txDropped: integer("tx_dropped").notNull().default(0),
  timestamp: integer("timestamp").notNull(),
});

// TCP connectivity check results
export const tcpConnectResults = sqliteTable("tcp_connect_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  host: text("host").notNull().default("1.1.1.1"),
  port: integer("port").notNull().default(443),
  status: text("status", { enum: ["ok", "timeout", "error"] }).notNull(),
  latencyMs: real("latency_ms"),
  timestamp: integer("timestamp").notNull(),
});

// Extended DNS quality checks
export const dnsExtraChecks = sqliteTable("dns_extra_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  consistency: text("consistency", { enum: ["ok", "mismatch", "unknown"] }).notNull(),
  nxdomain: text("nxdomain", { enum: ["ok", "fail"] }).notNull(),
  hijacking: text("hijacking", { enum: ["ok", "hijacked", "unknown"] }).notNull(),
  doh: text("doh", { enum: ["ok", "fail", "unknown"] }).notNull(),
  dnsLeak: text("dns_leak", { enum: ["ok", "leak", "unknown"] }).notNull().default("unknown"),
  timestamp: integer("timestamp").notNull(),
});

// Captive portal detection checks
export const captivePortalChecks = sqliteTable("captive_portal_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status", { enum: ["clean", "detected", "error"] }).notNull(),
  timestamp: integer("timestamp").notNull(),
});

// HTTP redirect / interception checks
export const httpRedirectChecks = sqliteTable("http_redirect_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status", { enum: ["ok", "intercepted", "error"] }).notNull(),
  timestamp: integer("timestamp").notNull(),
});

// NTP time sync checks
export const ntpChecks = sqliteTable("ntp_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status", { enum: ["ok", "fail"] }).notNull(),
  driftMs: integer("drift_ms"),
  timestamp: integer("timestamp").notNull(),
});

// OS resolver (nameserver) checks
export const osResolverChecks = sqliteTable("os_resolver_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status", { enum: ["ok", "fail"] }).notNull(),
  nameservers: text("nameservers").notNull(), // JSON array: '["1.1.1.1","8.8.8.8"]'
  timestamp: integer("timestamp").notNull(),
});
