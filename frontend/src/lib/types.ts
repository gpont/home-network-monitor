export interface WsMessage {
  event: string;
  data: unknown;
  timestamp: number;
}

export interface PingResult {
  id: number;
  target: string;
  targetLabel: string;
  status: "ok" | "timeout" | "error";
  rttMs: number | null;
  timestamp: number;
}

export interface DnsResult {
  id: number;
  server: string;
  serverLabel: string;
  domain: string;
  status: "ok" | "timeout" | "servfail" | "error";
  latencyMs: number | null;
  timestamp: number;
}

export interface HttpResult {
  id: number;
  url: string;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
  timestamp: number;
}

export interface TracerouteResult {
  id: number;
  target: string;
  hops: Array<{ hop: number; ip: string | null; rttMs: number | null }>;
  routingChanged: boolean;
  hasBlackHole?: boolean;
  timestamp: number;
}

export interface SpeedtestResult {
  id: number;
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  server: string | null;
  timestamp: number;
}

export interface PublicIpEvent {
  id: number;
  ipv4: string | null;
  ipv6: string | null;
  changed: boolean;
  timestamp: number;
}

export interface MiscCheck {
  id: number;
  type: "cgnat" | "mtu" | "dhcp" | "ipv6";
  status: string;
  value: string | null;
  timestamp: number;
}

export interface SslCheck {
  id: number;
  host: string;
  expiresAt: number | null;
  daysRemaining: number | null;
  status: "ok" | "warning" | "expired" | "error";
  error: string | null;
  timestamp: number;
}

export interface NetworkStat {
  id: number;
  interface: string;
  rxBytes: number;
  txBytes: number;
  rxErrors: number;
  txErrors: number;
  rxDropped: number;
  txDropped: number;
  timestamp: number;
}

export interface InterfaceCheck {
  interfaceName: string;
  status: 'up' | 'down' | 'unknown';
  ipv4: string | null;
  ipv6LinkLocal: string | null;
  gatewayIp: string | null;
  gatewayMac: string | null;
  connectionType: 'dhcp' | 'pppoe' | 'static' | 'unknown';
  rxErrors: number;
  txErrors: number;
  rxDropped: number;
  txDropped: number;
  timestamp: number;
}

export interface TcpConnectResult {
  host: string;
  port: number;
  status: 'ok' | 'timeout' | 'error';
  latencyMs: number | null;
  timestamp: number;
}

export interface DnsExtraCheck {
  consistency: 'ok' | 'mismatch' | 'unknown';
  nxdomain: 'ok' | 'fail';
  hijacking: 'ok' | 'hijacked' | 'unknown';
  doh: 'ok' | 'fail' | 'unknown';
  dnsLeak: 'ok' | 'leak' | 'unknown';
  timestamp: number;
}

export interface CaptivePortalCheck {
  status: 'clean' | 'detected' | 'error';
  timestamp: number;
}

export interface HttpRedirectCheck {
  status: 'ok' | 'intercepted' | 'error';
  timestamp: number;
}

export interface NtpCheck {
  status: 'ok' | 'fail';
  driftMs: number | null;
  timestamp: number;
}

export interface OsResolverCheck {
  status: 'ok' | 'fail';
  nameservers: string[];
  timestamp: number;
}

export interface PingStatsEntry {
  lossPercent: number;
  jitterMs: number | null;
  avgRttMs: number | null;
}

export interface PingStatsCheck {
  targets: Record<string, PingStatsEntry>;
}

export type CheckStatus = 'ok' | 'fail' | 'warn' | 'stale' | 'unknown' | 'info';

export interface CheckDefinition {
  id: string;
  layer: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  name: string;
  description: string;
  staleAfterMs: number;
  getValue(s: StatusResponse): string | null;
  getStatus(s: StatusResponse): CheckStatus;
  getFix(s: StatusResponse): string[] | null;
}

export interface LayerDefinition {
  id: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  name: string;
  icon: string;
}

export interface DiagnosticRule {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  condition(s: StatusResponse): boolean;
  title: string;
  description: string;
  steps: string[];
}

export interface StatusResponse {
  ping: PingResult[];
  dns: DnsResult[];
  http: HttpResult[];
  traceroute: TracerouteResult | null;
  speedtest: SpeedtestResult | null;
  publicIp: PublicIpEvent | null;
  cgnat: MiscCheck | null;
  mtu: MiscCheck | null;
  ipv6: MiscCheck | null;
  dhcp: MiscCheck | null;
  ssl: SslCheck[];
  networkStats: NetworkStat[];
  interface: InterfaceCheck | null;
  tcpConnect: TcpConnectResult | null;
  dnsExtra: DnsExtraCheck | null;
  captivePortal: CaptivePortalCheck | null;
  httpRedirect: HttpRedirectCheck | null;
  ntp: NtpCheck | null;
  osResolver: OsResolverCheck | null;
  pingStats: PingStatsCheck | null;
}

export interface PingStats {
  lossPercent: number;
  avgRtt: number | null;
  p95Rtt: number | null;
  jitter: number;
  samples: number;
}

export interface Event {
  type: "ip_change" | "routing_change" | "ssl_expiring";
  message: string;
  timestamp: number;
  data: unknown;
}
