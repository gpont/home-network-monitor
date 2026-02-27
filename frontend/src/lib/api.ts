import type {
  StatusResponse,
  PingResult,
  DnsResult,
  HttpResult,
  SpeedtestResult,
  TracerouteResult,
  Event,
  NetworkStat,
  SslCheck,
} from "./types.ts";

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const api = {
  status: () => get<StatusResponse>("/status"),

  pingHistory: (minutes = 60, target?: string) =>
    get<PingResult[]>(`/history/ping?minutes=${minutes}${target ? `&target=${target}` : ""}`),

  pingStats: () =>
    get<Record<string, Record<string, { lossPercent: number; avgRtt: number | null; p95Rtt: number | null; jitter: number; samples: number }>>>("/history/ping/stats"),

  dnsHistory: (minutes = 60) => get<DnsResult[]>(`/history/dns?minutes=${minutes}`),

  httpHistory: (minutes = 60) => get<HttpResult[]>(`/history/http?minutes=${minutes}`),

  speedtest: (limit = 48) => get<SpeedtestResult[]>(`/speedtest?limit=${limit}`),

  traceroute: (limit = 5) => get<TracerouteResult[]>(`/traceroute?limit=${limit}`),

  events: (limit = 50) => get<Event[]>(`/events?limit=${limit}`),

  networkStats: (minutes = 60) => get<NetworkStat[]>(`/network-stats?minutes=${minutes}`),

  ssl: () => get<SslCheck[]>("/ssl"),
};
