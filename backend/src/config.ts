export interface Config {
  port: number;
  dbPath: string;
  pingTargets: Array<{ host: string; label: string; ipv6?: boolean }>;
  dnsServers: Array<{ ip: string; label: string }>;
  httpTargets: string[];
  sslHosts: string[];
  iperf3Server: string | null;
  intervals: {
    ping: number; // ms
    dns: number;
    http: number;
    traceroute: number;
    speedtest: number;
    publicIp: number;
    cgnat: number;
    mtu: number;
    networkStats: number;
    ssl: number;
    dhcp: number;
  };
}

function parseTargets(env: string | undefined, defaults: Array<{ host: string; label: string }>) {
  if (!env) return defaults;
  return env.split(",").map(s => {
    const parts = s.trim().split(":");
    const host = parts[0] ?? s.trim();
    const label = parts.slice(1).join(":").trim() || host;
    return { host, label };
  });
}

function parseDnsServers(env: string | undefined, defaults: Array<{ ip: string; label: string }>) {
  if (!env) return defaults;
  return env.split(",").map(s => {
    const parts = s.trim().split(":");
    const ip = parts[0] ?? s.trim();
    const label = parts.slice(1).join(":").trim() || ip;
    return { ip, label };
  });
}

function parseHttpTargets(env: string | undefined, defaults: string[]) {
  if (!env) return defaults;
  return env.split(",").map(s => s.trim()).filter(Boolean);
}

export function loadConfig(): Config {
  return {
    port: parseInt(process.env["PORT"] ?? "3201"),
    dbPath: process.env["DB_PATH"] ?? "/app/data/monitor.db",

    pingTargets: parseTargets(process.env["PING_TARGETS"], [
      { host: "GATEWAY_PLACEHOLDER", label: "Router (auto)" },
      { host: "ISP_HOP_PLACEHOLDER", label: "ISP First Hop" },
      { host: "8.8.8.8", label: "Google DNS" },
      { host: "1.1.1.1", label: "Cloudflare" },
      { host: "9.9.9.9", label: "Quad9" },
    ]),

    dnsServers: parseDnsServers(process.env["DNS_SERVERS"], [
      { ip: "GATEWAY_PLACEHOLDER", label: "Router DNS" },
      { ip: "8.8.8.8", label: "Google 8.8.8.8" },
      { ip: "1.1.1.1", label: "Cloudflare 1.1.1.1" },
    ]),

    httpTargets: parseHttpTargets(process.env["HTTP_TARGETS"], [
      "https://www.google.com",
      "https://www.cloudflare.com",
      "https://github.com",
    ]),

    sslHosts: (process.env["SSL_HOSTS"] ?? "google.com,cloudflare.com,github.com")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean),

    iperf3Server: process.env["IPERF3_SERVER"] ?? null,

    intervals: {
      ping: 30_000,
      dns: 60_000,
      http: 60_000,
      traceroute: 10 * 60_000,
      speedtest: 60 * 60_000,
      publicIp: 5 * 60_000,
      cgnat: 60 * 60_000,
      mtu: 15 * 60_000,
      networkStats: 30_000,
      ssl: 24 * 60 * 60_000,
      dhcp: 5 * 60_000,
    },
  };
}
