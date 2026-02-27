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
