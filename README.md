# 📡 home-network-monitor

Network diagnostic dashboard for your home server.
Shows the full packet path (Device → Router → ISP → Internet → DNS → HTTP → Security)
with 53 checks, automatic problem diagnosis, and fix instructions.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Build](https://github.com/gpont/home-network-monitor/actions/workflows/docker.yml/badge.svg)](https://github.com/gpont/home-network-monitor/actions/workflows/docker.yml)
[![Docker](https://img.shields.io/badge/Docker-ghcr.io-blue?logo=docker)](https://github.com/gpont/home-network-monitor/pkgs/container/home-network-monitor)
[![self-hosted](https://img.shields.io/badge/self--hosted-%E2%9C%93-brightgreen)]()
[![no cloud](https://img.shields.io/badge/no_cloud-%E2%9C%93-brightgreen)]()
[![built with Bun](https://img.shields.io/badge/built_with-Bun-fbf0df?logo=bun)]()
[![Svelte 5](https://img.shields.io/badge/Svelte-5-ff3e00?logo=svelte&logoColor=white)]()

![Dashboard screenshot](docs/screenshot.png)

## Features

- 53 network checks across 7 layers (Device/Interface, Gateway, ISP/WAN, Internet, DNS, HTTP, Security)
- Automatic diagnosis: detects ISP outages, DNS failures, packet loss, MTU issues, CGNAT, captive portals, and more
- Fix instructions for every failed check
- Real-time updates via WebSocket
- Latency history, jitter, packet loss statistics
- Speedtest (download/upload), public IP change detection, SSL certificate monitoring
- No cloud, no account — runs entirely on your home server

## Requirements

- Linux server (x86_64)
- Docker + Docker Compose

## Quick Start

### Option 1 — docker run

```bash
docker run -d \
  --name home-network-monitor \
  --cap-add NET_RAW \
  --cap-add NET_ADMIN \
  --network host \
  -v $(pwd)/data:/app/data \
  -e PORT=3201 \
  ghcr.io/gpont/home-network-monitor:latest
```

Open `http://your-server-ip:3201`

### Option 2 — docker-compose

Create a `docker-compose.yml`:

```yaml
services:
  monitor:
    image: ghcr.io/gpont/home-network-monitor:latest
    container_name: home-network-monitor
    cap_add:
      - NET_RAW
      - NET_ADMIN
    network_mode: host
    volumes:
      - ./data:/app/data
    environment:
      - PORT=3201
    restart: unless-stopped
```

Then:

```bash
docker-compose up -d
```

Open `http://your-server-ip:3201`

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3201` | HTTP port the dashboard listens on |
| `DB_PATH` | `/app/data/monitor.db` | Path to the SQLite database inside the container |
| `SSL_HOSTS` | `google.com,cloudflare.com,github.com` | Comma-separated hostnames for SSL certificate checks |
| `IPERF3_SERVER` | — | IP of an iperf3 server for throughput testing (optional) |

Data is stored in `./data/` on the host — history is preserved across container restarts.

## Docker image

```
ghcr.io/gpont/home-network-monitor:latest
```

The container requires `--cap-add NET_RAW` (ICMP ping) and `--network host` (gateway/traceroute detection on Linux).

> **macOS / Docker Desktop:** `network_mode: host` doesn't work — use bridge networking with `-p 3201:3201` instead. Gateway and traceroute checks will be limited.

## Development

Requirements: [Bun](https://bun.sh)

```bash
npm install           # install all dependencies

npm run dev           # start backend + frontend simultaneously
npm run dev:backend   # backend only  → http://localhost:3001
npm run dev:frontend  # frontend only → http://localhost:5173

npm run build         # build frontend into backend/public/
npm run typecheck     # TypeScript check
bun test              # run all tests
```

Backend dev server runs on port `3001`; the frontend Vite dev server proxies `/api` and `/ws` there.

## Contributing

Contributions are welcome — bug reports, feature requests, and pull requests.
Open an issue to start a discussion.

## License

MIT — see [LICENSE](LICENSE)
