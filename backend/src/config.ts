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

export function loadConfig(): Config {
  return {
    port: parseInt(process.env["PORT"] ?? "3000"),
    dbPath: process.env["DB_PATH"] ?? "/app/data/monitor.db",

    pingTargets: [
      { host: "GATEWAY_PLACEHOLDER", label: "Router (auto)" }, // replaced at runtime
      { host: "ISP_HOP_PLACEHOLDER", label: "ISP First Hop" }, // replaced at runtime
      { host: "8.8.8.8", label: "Google DNS" },
      { host: "1.1.1.1", label: "Cloudflare" },
      { host: "9.9.9.9", label: "Quad9" },
    ],

    dnsServers: [
      { ip: "GATEWAY_PLACEHOLDER", label: "Router DNS" }, // replaced at runtime
      { ip: "8.8.8.8", label: "Google 8.8.8.8" },
      { ip: "1.1.1.1", label: "Cloudflare 1.1.1.1" },
    ],

    httpTargets: [
      "https://www.google.com",
      "https://www.cloudflare.com",
      "https://github.com",
    ],

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
