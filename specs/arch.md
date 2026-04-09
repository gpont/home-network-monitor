# Home Network Monitor — Architecture Spec

**Date:** 2026-04-09

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Container                          │
│  network_mode: host  │  cap_add: NET_RAW                    │
│                                                              │
│  ┌──────────────┐    ┌─────────────────────────────────┐   │
│  │  Scheduler   │───▶│  Checkers (10 modules)          │   │
│  │  setInterval │    │  ping, dns, http, traceroute,   │   │
│  └──────────────┘    │  speedtest, publicip, misc,     │   │
│         │            │  interface, system              │   │
│         ▼            └──────────────┬──────────────────┘   │
│  ┌──────────────┐                   │ write                 │
│  │  WebSocket   │    ┌──────────────▼──────────────────┐   │
│  │  broadcast   │    │  SQLite DB  (monitor.db)        │   │
│  └──────────────┘    └──────────────┬──────────────────┘   │
│         ▲                           │ read                  │
│         │            ┌──────────────▼──────────────────┐   │
│  ┌──────┴───────┐    │  Hono REST API  /api/status     │   │
│  │  Browser     │◀───│  + static files (Svelte SPA)    │   │
│  └──────────────┘    └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```
home-network-monitor/
├── backend/
│   └── src/
│       ├── index.ts              # Hono app, Bun.serve(), WebSocket
│       ├── config.ts             # env vars + defaults
│       ├── scheduler.ts          # check runners, gateway detection, WS broadcast
│       ├── types.d.ts            # speedtest-net types
│       ├── checkers/
│       │   ├── utils.ts          # spawn() wrapper
│       │   ├── ping.ts           # ICMP + TCP connect
│       │   ├── dns.ts            # dig + consistency/NXDOMAIN/hijacking/DoH
│       │   ├── http.ts           # fetch + captive portal + redirect
│       │   ├── traceroute.ts     # traceroute + black hole detection
│       │   ├── speedtest.ts      # speedtest-net
│       │   ├── publicip.ts       # ipify.org
│       │   ├── misc.ts           # CGNAT, MTU, IPv6, DHCP, SSL
│       │   ├── interface.ts      # ip link/addr/route, arp -n  [NEW]
│       │   └── system.ts         # NTP UDP, /etc/resolv.conf  [NEW]
│       ├── db/
│       │   ├── schema.ts         # Drizzle table definitions
│       │   ├── client.ts         # SQLite init + DDL migration
│       │   └── cleanup.ts        # daily data retention cleanup  [NEW]
│       └── routes/
│           └── api.ts            # all REST endpoints
├── frontend/
│   └── src/
│       ├── App.svelte            # main dashboard
│       ├── main.ts
│       ├── lib/
│       │   ├── api.ts            # fetch wrappers
│       │   ├── ws.ts             # WebSocket client + store
│       │   ├── types.ts          # API TypeScript interfaces
│       │   ├── checks.ts         # 53 check definitions  [NEW]
│       │   └── diagnostics.ts    # diagnostic rules engine  [NEW]
│       └── components/
│           ├── PathChain.svelte  # packet path visualization  [NEW]
│           ├── DiagBanner.svelte # diagnostic result card  [NEW]
│           ├── LayerCard.svelte  # network layer section  [NEW]
│           └── CheckRow.svelte   # single check row  [NEW]
├── specs/
│   ├── design.md
│   └── arch.md
├── .github/
│   └── workflows/
│       └── docker.yml            # CI/CD  [NEW]
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .npmrc
├── LICENSE                       # MIT  [NEW]
└── README.md                     # [NEW/REWRITE]
```

---

## 3. Database Schema

### Existing Tables (unchanged)

```sql
CREATE TABLE ping_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target TEXT NOT NULL,
  target_label TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ok','timeout','error')),
  rtt_ms REAL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE dns_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server TEXT NOT NULL,
  server_label TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ok','timeout','servfail','error')),
  latency_ms REAL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE http_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  status_code INTEGER,
  latency_ms REAL,
  error TEXT,
  timestamp INTEGER NOT NULL
);

CREATE TABLE traceroute_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target TEXT NOT NULL,
  hops TEXT NOT NULL,          -- JSON: [{hop,ip,rttMs}]
  routing_changed INTEGER NOT NULL DEFAULT 0,
  has_black_hole INTEGER NOT NULL DEFAULT 0,  -- [NEW field]
  timestamp INTEGER NOT NULL
);

CREATE TABLE speedtest_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  download_mbps REAL NOT NULL,
  upload_mbps REAL NOT NULL,
  ping_ms REAL NOT NULL,
  server TEXT,
  timestamp INTEGER NOT NULL
);

CREATE TABLE public_ip_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ipv4 TEXT,
  ipv6 TEXT,
  changed INTEGER NOT NULL DEFAULT 0,
  timestamp INTEGER NOT NULL
);

CREATE TABLE network_stats (
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

CREATE TABLE ssl_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  host TEXT NOT NULL,
  expires_at INTEGER,
  days_remaining INTEGER,
  status TEXT NOT NULL CHECK(status IN ('ok','warning','expired','error')),
  -- warning threshold: 30 days (changed from 14)
  error TEXT,
  timestamp INTEGER NOT NULL
);

CREATE TABLE misc_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,    -- 'cgnat','mtu','dhcp','ipv6' (enum stays as-is)
  status TEXT NOT NULL,
  value TEXT,            -- JSON
  timestamp INTEGER NOT NULL
);
```

### New Tables

```sql
CREATE TABLE interface_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  interface_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('up','down','unknown')),
  ipv4 TEXT,
  ipv6_link_local TEXT,
  gateway_ip TEXT,
  gateway_mac TEXT,
  connection_type TEXT CHECK(connection_type IN ('dhcp','pppoe','static','unknown')),
  rx_errors INTEGER NOT NULL DEFAULT 0,
  tx_errors INTEGER NOT NULL DEFAULT 0,
  rx_dropped INTEGER NOT NULL DEFAULT 0,
  tx_dropped INTEGER NOT NULL DEFAULT 0,
  timestamp INTEGER NOT NULL
);

CREATE TABLE tcp_connect_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  host TEXT NOT NULL DEFAULT '1.1.1.1',
  port INTEGER NOT NULL DEFAULT 443,
  status TEXT NOT NULL CHECK(status IN ('ok','timeout','error')),
  latency_ms REAL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE dns_extra_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consistency TEXT NOT NULL CHECK(consistency IN ('ok','mismatch','unknown')),
  nxdomain TEXT NOT NULL CHECK(nxdomain IN ('ok','fail')),
  hijacking TEXT NOT NULL CHECK(hijacking IN ('ok','hijacked','unknown')),
  doh TEXT NOT NULL CHECK(doh IN ('ok','fail','unknown')),
  timestamp INTEGER NOT NULL
);

CREATE TABLE captive_portal_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL CHECK(status IN ('clean','detected','error')),
  timestamp INTEGER NOT NULL
);

CREATE TABLE http_redirect_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL CHECK(status IN ('ok','intercepted','error')),
  timestamp INTEGER NOT NULL
);

CREATE TABLE ntp_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL CHECK(status IN ('ok','fail')),
  drift_ms INTEGER,
  timestamp INTEGER NOT NULL
);
```

---

## 4. API Contract

### `GET /api/status`

Returns the current state of all checks. Frontend polls this every 10s + WS push triggers reload.

**Response type** (TypeScript):

```ts
interface StatusResponse {
  // ── Existing ──────────────────────────────────────────────
  ping: PingResult[];           // latest per target
  dns: DnsResult[];             // latest per server
  http: HttpResult[];           // latest per url
  traceroute: TracerouteResult | null;
  speedtest: SpeedtestResult | null;
  publicIp: PublicIpEvent | null;
  cgnat: MiscCheck | null;
  mtu: MiscCheck | null;
  ipv6: MiscCheck | null;
  dhcp: MiscCheck | null;
  ssl: SslCheck[];              // latest per host
  networkStats: NetworkStat[];  // latest per interface

  // ── New ───────────────────────────────────────────────────
  interface: InterfaceCheck | null;
  tcpConnect: TcpConnectResult | null;
  dnsExtra: DnsExtraCheck | null;
  captivePortal: CaptivePortalCheck | null;
  httpRedirect: HttpRedirectCheck | null;
  ntp: NtpCheck | null;
  osResolver: OsResolverCheck | null;
  pingStats: PingStatsCheck | null;  // pre-computed loss%/jitter/avg за 15 мин
}

interface InterfaceCheck {
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

interface TcpConnectResult {
  host: string;
  port: number;
  status: 'ok' | 'timeout' | 'error';
  latencyMs: number | null;
  timestamp: number;
}

interface DnsExtraCheck {
  consistency: 'ok' | 'mismatch' | 'unknown';
  nxdomain: 'ok' | 'fail';
  hijacking: 'ok' | 'hijacked' | 'unknown';
  doh: 'ok' | 'fail' | 'unknown';
  timestamp: number;
}

interface CaptivePortalCheck {
  status: 'clean' | 'detected' | 'error';
  timestamp: number;
}

interface HttpRedirectCheck {
  status: 'ok' | 'intercepted' | 'error';
  timestamp: number;
}

interface NtpCheck {
  status: 'ok' | 'fail';
  driftMs: number | null;
  timestamp: number;
}

interface OsResolverCheck {
  status: 'ok' | 'fail';
  nameservers: string[];
  timestamp: number;
}

interface PingStatsCheck {
  targets: {
    [target: string]: {
      lossPercent: number;
      jitterMs: number;
      avgRttMs: number | null;
    };
  };
  timestamp: number;
}
```

---

## 5. Frontend Architecture

### Data Flow

```
App.svelte
  onMount → fetch /api/status → StatusResponse
  onWsEvent('*') → re-fetch /api/status
  setInterval(10s) → re-fetch /api/status
         │
         ▼
  evaluate(status) → DiagnosticResult[]   (lib/diagnostics.ts)
  CHECKS.map(getStatus, getValue)         (lib/checks.ts)
         │
         ├── PathChain.svelte   (layers: LayerStatus[])
         ├── DiagBanner.svelte  (foreach active rule)
         └── LayerCard.svelte   (foreach layer)
               └── CheckRow.svelte (foreach check in layer)
```

### `lib/checks.ts` structure

```ts
interface CheckDefinition {
  id: string;
  layer: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  name: string;
  description: string;
  staleAfterMs: number;                           // 2 × check interval
  getValue(s: StatusResponse): string | null;
  getStatus(s: StatusResponse): CheckStatus;
  getFix(s: StatusResponse): string[] | null;
}

type CheckStatus = 'ok' | 'fail' | 'warn' | 'stale' | 'unknown' | 'info';

// Layer definitions
const LAYERS = [
  { id: 1, name: 'Device / Interface',    icon: '🖥' },
  { id: 2, name: 'Gateway / Local',       icon: '📡' },
  { id: 3, name: 'ISP / WAN',             icon: '🌐' },
  { id: 4, name: 'Internet (L3)',         icon: '🌍' },
  { id: 5, name: 'DNS',                   icon: '🔍' },
  { id: 6, name: 'HTTP / Application',    icon: '🌏' },
  { id: 7, name: 'Security / Advanced',   icon: '🔐' },
];
```

### `lib/diagnostics.ts` structure

```ts
interface DiagnosticRule {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  condition(s: StatusResponse): boolean;
  title: string;
  description: string;
  steps: string[];
}

export function evaluate(s: StatusResponse): DiagnosticRule[] {
  return RULES.filter(r => r.condition(s));
}
// Returns only triggered rules, sorted: critical → warning → info
```

---

## 6. CI/CD Pipeline

### `.github/workflows/docker.yml`

```yaml
# Triggers:
#   push to main  → builds and pushes :latest
#   push tag v*   → builds and pushes :vX.Y.Z AND updates :latest

name: Build and Push Docker Image

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - name: Build frontend
        run: |
          bun install
          cd frontend && bun run build
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ghcr.io/gpont/home-network-monitor
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable={{is_default_branch}}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

### Release Process

```bash
git tag v1.0.0
git push origin v1.0.0
# → CI builds and pushes ghcr.io/gpont/home-network-monitor:v1.0.0 + :latest
```

---

## 7. Dockerfile Structure

```dockerfile
# Stage 1: Build frontend
FROM oven/bun:1-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/ .
COPY .npmrc /root/
RUN bun install && bun run build

# Stage 2: Backend runtime
FROM oven/bun:1-alpine
WORKDIR /app

# Install system tools for checkers
RUN apk add --no-cache \
  iproute2 \       # ip link, ip addr, ip route
  iputils \        # ping with -M do (DF bit)
  bind-tools \     # dig
  traceroute \     # traceroute
  libcap            # (if needed for capabilities)

COPY backend/ ./backend/
COPY .npmrc /root/
RUN cd backend && bun install

COPY --from=frontend-builder /app/frontend/../backend/public ./backend/public

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:3000/api/status || exit 1

CMD ["bun", "run", "backend/src/index.ts"]
```

---

## 8. Data Retention

`db/cleanup.ts` — runs daily at midnight via `setInterval`.

```ts
// Retention periods (DELETE WHERE timestamp < cutoff)
const RETENTION = {
  ping_results:           48 * 60 * 60 * 1000,   // 48h
  dns_results:            48 * 60 * 60 * 1000,
  http_results:           48 * 60 * 60 * 1000,
  captive_portal_checks:  48 * 60 * 60 * 1000,
  http_redirect_checks:   48 * 60 * 60 * 1000,
  traceroute_results:     30 * 24 * 60 * 60 * 1000,  // 30 days
  misc_checks:            30 * 24 * 60 * 60 * 1000,
  interface_checks:       30 * 24 * 60 * 60 * 1000,
  tcp_connect_results:    30 * 24 * 60 * 60 * 1000,
  dns_extra_checks:       30 * 24 * 60 * 60 * 1000,
  ntp_checks:             30 * 24 * 60 * 60 * 1000,
  speedtest_results:      90 * 24 * 60 * 60 * 1000,  // 90 days
  public_ip_events:       90 * 24 * 60 * 60 * 1000,
  ssl_checks:             90 * 24 * 60 * 60 * 1000,
  network_stats:          90 * 24 * 60 * 60 * 1000,
};
```

---

## 9. README Structure

```markdown
# home-network-monitor

Network diagnostic dashboard for your home server.
Shows the full packet path (Device → Router → ISP → Internet → DNS → HTTP → Security)
with 53 checks, automatic problem diagnosis, and fix instructions.

[Screenshot]

## Features
- 53 network checks across 7 layers
- Automatic diagnosis: detects ISP outages, DNS failures, packet loss, MTU issues, etc.
- Fix instructions for every failed check
- Real-time updates via WebSocket
- No cloud, no account — runs entirely on your home server

## Requirements
- Linux server (x86_64)
- Docker + Docker Compose

## Quick Start
\`\`\`bash
git clone https://github.com/gpont/home-network-monitor
cd home-network-monitor
cp .env.example .env
docker-compose up -d
\`\`\`
Open http://your-server-ip:3000

## Configuration
| Variable | Default | Description |
...

## License
MIT
```
