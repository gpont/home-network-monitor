# Network Monitor Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полный редизайн дашборда — 53 диагностических чека по 7 слоям сети, визуализация пути пакета, автоматический диагноз проблем с инструкциями по починке.

**Architecture:** Backend расширяется новыми чекерами (interface.ts, system.ts) и новыми таблицами БД. `/api/status` возвращает все 53 чека одним запросом. Frontend переписывается полностью: новые компоненты PathChain, LayerCard, CheckRow, DiagBanner; логика диагностики — чистые функции в `lib/checks.ts` и `lib/diagnostics.ts`, покрытые unit-тестами.

**Tech Stack:** Bun + Hono + Drizzle ORM + SQLite (backend), Svelte 5 + Vite (frontend), Docker + GitHub Actions CI/CD.

**Specs:** `specs/design.md`, `specs/arch.md`

**Test runner:** `bun test` (Bun built-in, files `**/*.test.ts`)

**Before starting:** Read `specs/design.md` and `specs/arch.md` fully. They contain the complete check inventory, diagnostic rules, TypeScript interfaces, and DB schema.

---

## Phase 1 — Foundation

### Task 1: MIT License + README skeleton

**Files:**
- Create: `LICENSE`
- Create: `README.md`

- [ ] Create `LICENSE` with MIT text, year 2026, author `gpont`
- [ ] Create `README.md` with structure from `specs/arch.md` section 9 — leave screenshot placeholder, fill in all sections with real content
- [ ] Commit:
```bash
git add LICENSE README.md
git commit -m "docs: add MIT license and README"
```

---

### Task 2: Extend `config.ts` — configurable targets

**Files:**
- Modify: `backend/src/config.ts`
- Test: `backend/src/config.test.ts`

- [ ] Write failing test:
```ts
// backend/src/config.test.ts
import { describe, test, expect } from "bun:test";
import { loadConfig } from "./config.ts";

describe("loadConfig", () => {
  test("uses default ping targets when PING_TARGETS not set", () => {
    delete process.env.PING_TARGETS;
    const config = loadConfig();
    expect(config.pingTargets.some(t => t.host === "8.8.8.8")).toBe(true);
  });

  test("parses PING_TARGETS env var", () => {
    process.env.PING_TARGETS = "1.2.3.4:My Server,5.6.7.8:Other";
    const config = loadConfig();
    expect(config.pingTargets).toContainEqual({ host: "1.2.3.4", label: "My Server" });
    expect(config.pingTargets).toContainEqual({ host: "5.6.7.8", label: "Other" });
    delete process.env.PING_TARGETS;
  });

  test("parses HTTP_TARGETS env var", () => {
    process.env.HTTP_TARGETS = "https://example.com,https://test.com";
    const config = loadConfig();
    expect(config.httpTargets).toEqual(["https://example.com", "https://test.com"]);
    delete process.env.HTTP_TARGETS;
  });

  test("parses DNS_SERVERS env var", () => {
    process.env.DNS_SERVERS = "8.8.4.4:Google2,208.67.222.222:OpenDNS";
    const config = loadConfig();
    expect(config.dnsServers).toContainEqual({ ip: "8.8.4.4", label: "Google2" });
    delete process.env.DNS_SERVERS;
  });
});
```
- [ ] Run: `bun test backend/src/config.test.ts` — expect FAIL
- [ ] Update `config.ts` — add parsing helpers and new env vars:
```ts
function parseTargets(env: string | undefined, defaults: Array<{ host: string; label: string }>) {
  if (!env) return defaults;
  return env.split(",").map(s => {
    const [host, ...labelParts] = s.trim().split(":");
    return { host: host.trim(), label: labelParts.join(":").trim() || host.trim() };
  });
}

function parseDnsServers(env: string | undefined, defaults: Array<{ ip: string; label: string }>) {
  if (!env) return defaults;
  return env.split(",").map(s => {
    const [ip, ...labelParts] = s.trim().split(":");
    return { ip: ip.trim(), label: labelParts.join(":").trim() || ip.trim() };
  });
}

function parseHttpTargets(env: string | undefined, defaults: string[]) {
  if (!env) return defaults;
  return env.split(",").map(s => s.trim()).filter(Boolean);
}
```
  Add to `loadConfig()`:
```ts
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
```
- [ ] Run: `bun test backend/src/config.test.ts` — expect PASS
- [ ] Update `.env.example` with new vars
- [ ] Commit:
```bash
git add backend/src/config.ts backend/src/config.test.ts .env.example
git commit -m "feat: configurable ping/dns/http targets via env vars"
```

---

### Task 3: New DB tables + schema migration

**Files:**
- Modify: `backend/src/db/schema.ts`
- Modify: `backend/src/db/client.ts`

- [ ] Add 7 new table definitions to `schema.ts` (copy exact SQL from `specs/arch.md` section 3, translate to Drizzle DSL). Таблицы: `interface_checks`, `tcp_connect_results`, `dns_extra_checks` (с полем `dnsLeak`), `captive_portal_checks`, `http_redirect_checks`, `ntp_checks`, `os_resolver_checks`:

```ts
// interface_checks
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

export const tcpConnectResults = sqliteTable("tcp_connect_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  host: text("host").notNull().default("1.1.1.1"),
  port: integer("port").notNull().default(443),
  status: text("status", { enum: ["ok", "timeout", "error"] }).notNull(),
  latencyMs: real("latency_ms"),
  timestamp: integer("timestamp").notNull(),
});

export const dnsExtraChecks = sqliteTable("dns_extra_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  consistency: text("consistency", { enum: ["ok", "mismatch", "unknown"] }).notNull(),
  nxdomain: text("nxdomain", { enum: ["ok", "fail"] }).notNull(),
  hijacking: text("hijacking", { enum: ["ok", "hijacked", "unknown"] }).notNull(),
  doh: text("doh", { enum: ["ok", "fail", "unknown"] }).notNull(),
  dnsLeak: text("dns_leak", { enum: ["ok", "leak", "unknown"] }).notNull().default("unknown"),
  timestamp: integer("timestamp").notNull(),
});

export const captivePortalChecks = sqliteTable("captive_portal_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status", { enum: ["clean", "detected", "error"] }).notNull(),
  timestamp: integer("timestamp").notNull(),
});

export const httpRedirectChecks = sqliteTable("http_redirect_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status", { enum: ["ok", "intercepted", "error"] }).notNull(),
  timestamp: integer("timestamp").notNull(),
});

export const ntpChecks = sqliteTable("ntp_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status", { enum: ["ok", "fail"] }).notNull(),
  driftMs: integer("drift_ms"),
  timestamp: integer("timestamp").notNull(),
});

export const osResolverChecks = sqliteTable("os_resolver_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status", { enum: ["ok", "fail"] }).notNull(),
  nameservers: text("nameservers").notNull(),  // JSON array: '["1.1.1.1","8.8.8.8"]'
  timestamp: integer("timestamp").notNull(),
});
```

> **Примечание:** таблиц теперь 7 новых (не 6 как написано выше). Добавлена `os_resolver_checks` для хранения состояния `/etc/resolv.conf`.

- [ ] Also add `hasBlackHole` field to `tracerouteResults`:
```ts
hasBlackHole: integer("has_black_hole", { mode: "boolean" }).notNull().default(false),
```

- [ ] In `client.ts`, the existing `CREATE TABLE IF NOT EXISTS` DDL migration runs at startup — new tables will be auto-created since Drizzle uses `IF NOT EXISTS`. Verify this is the case; if not, add the new CREATE TABLE statements to the DDL block.

- [ ] Run: `bun run backend/src/index.ts` briefly, check logs for schema errors, then kill

- [ ] Commit:
```bash
git add backend/src/db/schema.ts backend/src/db/client.ts
git commit -m "feat: add 7 new DB tables for extended checks"
```

---

### Task 4: Data retention cleanup job

**Files:**
- Create: `backend/src/db/cleanup.ts`
- Test: `backend/src/db/cleanup.test.ts`

- [ ] Write failing test:
```ts
// backend/src/db/cleanup.test.ts
import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { pingResults } from "./schema.ts";
import { runCleanup } from "./cleanup.ts";

function createTestDb() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS ping_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target TEXT NOT NULL, target_label TEXT NOT NULL,
    status TEXT NOT NULL, rtt_ms REAL,
    timestamp INTEGER NOT NULL
  )`);
  return db;
}

describe("runCleanup", () => {
  test("deletes ping results older than 48h", async () => {
    const db = createTestDb();
    const now = Date.now();
    const old = now - 49 * 60 * 60 * 1000; // 49 hours ago
    const recent = now - 1 * 60 * 60 * 1000; // 1 hour ago

    await db.insert(pingResults).values([
      { target: "8.8.8.8", targetLabel: "Google", status: "ok", rttMs: 10, timestamp: old },
      { target: "8.8.8.8", targetLabel: "Google", status: "ok", rttMs: 10, timestamp: recent },
    ]);

    await runCleanup(db);

    const remaining = await db.select().from(pingResults);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].timestamp).toBe(recent);
  });
});
```
- [ ] Run: `bun test backend/src/db/cleanup.test.ts` — expect FAIL
- [ ] Implement `cleanup.ts`:
```ts
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { lt } from "drizzle-orm";
import {
  pingResults, dnsResults, httpResults, captivePortalChecks, httpRedirectChecks,
  tracerouteResults, miscChecks, interfaceChecks, tcpConnectResults, dnsExtraChecks, ntpChecks,
  osResolverChecks, speedtestResults, publicIpEvents, sslChecks, networkStats,
} from "./schema.ts";

const MS = { h48: 48*60*60*1000, d30: 30*24*60*60*1000, d90: 90*24*60*60*1000 };

export async function runCleanup(db: BunSQLiteDatabase<any>) {
  const now = Date.now();
  const cuts = { h48: now - MS.h48, d30: now - MS.d30, d90: now - MS.d90 };

  await Promise.all([
    db.delete(pingResults).where(lt(pingResults.timestamp, cuts.h48)),
    db.delete(dnsResults).where(lt(dnsResults.timestamp, cuts.h48)),
    db.delete(httpResults).where(lt(httpResults.timestamp, cuts.h48)),
    db.delete(captivePortalChecks).where(lt(captivePortalChecks.timestamp, cuts.h48)),
    db.delete(httpRedirectChecks).where(lt(httpRedirectChecks.timestamp, cuts.h48)),
    db.delete(tracerouteResults).where(lt(tracerouteResults.timestamp, cuts.d30)),
    db.delete(miscChecks).where(lt(miscChecks.timestamp, cuts.d30)),
    db.delete(interfaceChecks).where(lt(interfaceChecks.timestamp, cuts.d30)),
    db.delete(tcpConnectResults).where(lt(tcpConnectResults.timestamp, cuts.d30)),
    db.delete(dnsExtraChecks).where(lt(dnsExtraChecks.timestamp, cuts.d30)),
    db.delete(ntpChecks).where(lt(ntpChecks.timestamp, cuts.d30)),
    db.delete(osResolverChecks).where(lt(osResolverChecks.timestamp, cuts.d30)),
    db.delete(speedtestResults).where(lt(speedtestResults.timestamp, cuts.d90)),
    db.delete(publicIpEvents).where(lt(publicIpEvents.timestamp, cuts.d90)),
    db.delete(sslChecks).where(lt(sslChecks.timestamp, cuts.d90)),
    db.delete(networkStats).where(lt(networkStats.timestamp, cuts.d90)),
  ]);
}

export function scheduleCleanup(db: BunSQLiteDatabase<any>) {
  // Run once at startup, then every 24h
  runCleanup(db).catch(console.error);
  setInterval(() => runCleanup(db).catch(console.error), 24 * 60 * 60 * 1000);
}
```
- [ ] Import and call `scheduleCleanup(db)` in `scheduler.ts`
- [ ] Run: `bun test backend/src/db/cleanup.test.ts` — expect PASS
- [ ] Commit:
```bash
git add backend/src/db/cleanup.ts backend/src/db/cleanup.test.ts backend/src/scheduler.ts
git commit -m "feat: daily data retention cleanup"
```

---

## Phase 2 — New Checkers

### Task 5: `interface.ts` — network interface status

**Files:**
- Create: `backend/src/checkers/interface.ts`
- Test: `backend/src/checkers/interface.test.ts`

- [ ] Write failing tests:
```ts
// backend/src/checkers/interface.test.ts
import { describe, test, expect } from "bun:test";
import { parseIpLinkOutput, parseIpAddrOutput, parseIpRouteOutput, parseArpOutput } from "./interface.ts";

describe("parseIpLinkOutput", () => {
  test("detects interface UP", () => {
    const out = "2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP";
    expect(parseIpLinkOutput(out)).toEqual({ name: "eth0", status: "up" });
  });
  test("detects interface DOWN", () => {
    const out = "2: eth0: <BROADCAST,MULTICAST> mtu 1500 qdisc noop state DOWN";
    expect(parseIpLinkOutput(out)).toEqual({ name: "eth0", status: "down" });
  });
});

describe("parseIpAddrOutput", () => {
  test("extracts IPv4 address", () => {
    const out = "    inet 192.168.1.5/24 brd 192.168.1.255 scope global eth0";
    expect(parseIpAddrOutput(out).ipv4).toBe("192.168.1.5");
  });
  test("extracts IPv6 link-local", () => {
    const out = "    inet6 fe80::1a2b:3c4d:5e6f:7a8b/64 scope link";
    expect(parseIpAddrOutput(out).ipv6LinkLocal).toBe("fe80::1a2b:3c4d:5e6f:7a8b");
  });
});

describe("parseIpRouteOutput", () => {
  test("extracts default gateway", () => {
    const out = "default via 192.168.1.1 dev eth0 proto dhcp";
    expect(parseIpRouteOutput(out)).toEqual({ gatewayIp: "192.168.1.1", connectionType: "dhcp" });
  });
  test("detects PPPoE", () => {
    const out = "default via 10.0.0.1 dev ppp0 proto kernel";
    expect(parseIpRouteOutput(out).connectionType).toBe("pppoe");
  });
});

describe("parseArpOutput", () => {
  test("extracts MAC for known IP", () => {
    const out = "192.168.1.1 ether aa:bb:cc:dd:ee:ff C eth0";
    expect(parseArpOutput("192.168.1.1", out)).toBe("aa:bb:cc:dd:ee:ff");
  });
  test("returns null when IP not in table", () => {
    const out = "192.168.1.2 ether aa:bb:cc:dd:ee:ff C eth0";
    expect(parseArpOutput("192.168.1.1", out)).toBeNull();
  });
});
```
- [ ] Run: `bun test backend/src/checkers/interface.test.ts` — expect FAIL
- [ ] Implement `interface.ts`:
```ts
import { db } from "../db/client.ts";
import { interfaceChecks } from "../db/schema.ts";
import { spawn } from "./utils.ts";

export function parseIpLinkOutput(out: string): { name: string; status: "up" | "down" | "unknown" } {
  const m = out.match(/\d+:\s+(\S+):.*state\s+(UP|DOWN)/i);
  if (!m) return { name: "unknown", status: "unknown" };
  return { name: m[1].replace(/@.*/, ""), status: m[2].toUpperCase() === "UP" ? "up" : "down" };
}

export function parseIpAddrOutput(out: string): { ipv4: string | null; ipv6LinkLocal: string | null } {
  const v4 = out.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
  const v6 = out.match(/inet6\s+(fe80:[^\s/]+)/i);
  return { ipv4: v4?.[1] ?? null, ipv6LinkLocal: v6?.[1] ?? null };
}

export function parseIpRouteOutput(out: string): { gatewayIp: string | null; connectionType: "dhcp" | "pppoe" | "static" | "unknown" } {
  const m = out.match(/default via (\S+)/);
  if (!m) return { gatewayIp: null, connectionType: "unknown" };
  const pppoe = /ppp\d/.test(out);
  const dhcp = /dhcp/.test(out);
  return {
    gatewayIp: m[1],
    connectionType: pppoe ? "pppoe" : dhcp ? "dhcp" : "static",
  };
}

export function parseArpOutput(ip: string, out: string): string | null {
  const escaped = ip.replace(/\./g, "\\.");
  const m = out.match(new RegExp(`${escaped}\\s+ether\\s+([\\da-f:]+)`, "i"));
  return m?.[1] ?? null;
}

export async function checkInterface() {
  const timestamp = Date.now();
  try {
    const [linkOut, addrOut, routeOut] = await Promise.all([
      spawn(["ip", "link", "show"], 3000),
      spawn(["ip", "addr", "show"], 3000),
      spawn(["ip", "route", "show", "default"], 3000),
    ]);

    const link = parseIpLinkOutput(linkOut);
    const addr = parseIpAddrOutput(addrOut);
    const route = parseIpRouteOutput(routeOut);

    let gatewayMac: string | null = null;
    if (route.gatewayIp) {
      const arpOut = await spawn(["arp", "-n", route.gatewayIp], 2000).catch(() => "");
      gatewayMac = parseArpOutput(route.gatewayIp, arpOut);
    }

    // Read /proc/net/dev for errors/drops
    let rxErrors = 0, txErrors = 0, rxDropped = 0, txDropped = 0;
    try {
      const procOut = await Bun.file("/proc/net/dev").text();
      const line = procOut.split("\n").find(l => l.includes(link.name));
      if (line) {
        const parts = line.trim().split(/\s+/);
        // Format: iface: rxBytes rxPkts rxErrors rxDrop ... txBytes txPkts txErrors txDrop ...
        rxErrors = parseInt(parts[3] ?? "0");
        rxDropped = parseInt(parts[4] ?? "0");
        txErrors = parseInt(parts[11] ?? "0");
        txDropped = parseInt(parts[12] ?? "0");
      }
    } catch { /* not on Linux */ }

    const result = {
      interfaceName: link.name,
      status: link.status,
      ipv4: addr.ipv4,
      ipv6LinkLocal: addr.ipv6LinkLocal,
      gatewayIp: route.gatewayIp,
      gatewayMac,
      connectionType: route.connectionType,
      rxErrors, txErrors, rxDropped, txDropped,
      timestamp,
    };

    await db.insert(interfaceChecks).values(result);
    return result;
  } catch (e) {
    const result = {
      interfaceName: "unknown", status: "unknown" as const,
      ipv4: null, ipv6LinkLocal: null, gatewayIp: null, gatewayMac: null,
      connectionType: "unknown" as const,
      rxErrors: 0, txErrors: 0, rxDropped: 0, txDropped: 0,
      timestamp,
    };
    await db.insert(interfaceChecks).values(result);
    return result;
  }
}
```
- [ ] Run: `bun test backend/src/checkers/interface.test.ts` — expect PASS
- [ ] Commit:
```bash
git add backend/src/checkers/interface.ts backend/src/checkers/interface.test.ts
git commit -m "feat: interface.ts checker - network interface status"
```

---

### Task 6: `system.ts` — NTP + OS resolver

**Files:**
- Create: `backend/src/checkers/system.ts`
- Test: `backend/src/checkers/system.test.ts`

- [ ] Write failing tests:
```ts
// backend/src/checkers/system.test.ts
import { describe, test, expect } from "bun:test";
import { parseResolvConf, buildNtpPacket, parseNtpResponse } from "./system.ts";

describe("parseResolvConf", () => {
  test("extracts nameservers", () => {
    const content = "# comment\nnameserver 192.168.1.1\nnameserver 8.8.8.8\n";
    expect(parseResolvConf(content)).toEqual(["192.168.1.1", "8.8.8.8"]);
  });
  test("returns empty array for no nameservers", () => {
    expect(parseResolvConf("# only comments\n")).toEqual([]);
  });
});

describe("parseNtpResponse", () => {
  test("returns drift within tolerance", () => {
    // NTP epoch: Jan 1 1900. Unix epoch: Jan 1 1970. Diff = 2208988800s
    const NTP_EPOCH_OFFSET = 2208988800;
    const nowSec = Math.floor(Date.now() / 1000) + NTP_EPOCH_OFFSET;
    const buf = Buffer.alloc(48);
    buf.writeUInt32BE(nowSec, 40);   // transmit timestamp seconds
    buf.writeUInt32BE(0, 44);        // transmit timestamp fraction
    const result = parseNtpResponse(buf);
    expect(result.driftMs).toBeLessThan(5000);
    expect(result.status).toBe("ok");
  });
});
```
- [ ] Run: `bun test backend/src/checkers/system.test.ts` — expect FAIL
- [ ] Implement `system.ts`:
```ts
import { db } from "../db/client.ts";
import { ntpChecks, osResolverChecks } from "../db/schema.ts";

export function parseResolvConf(content: string): string[] {
  return content
    .split("\n")
    .filter(l => l.trimStart().startsWith("nameserver"))
    .map(l => l.split(/\s+/)[1])
    .filter(Boolean);
}

export function buildNtpPacket(): Buffer {
  const buf = Buffer.alloc(48);
  buf[0] = 0x23; // LI=0, VN=4, Mode=3 (client)
  return buf;
}

export function parseNtpResponse(buf: Buffer): { status: "ok" | "fail"; driftMs: number } {
  const NTP_EPOCH = 2208988800;
  const ntpSec = buf.readUInt32BE(40);
  const ntpFrac = buf.readUInt32BE(44);
  const ntpMs = (ntpSec - NTP_EPOCH) * 1000 + Math.round(ntpFrac / 4294967.296);
  const driftMs = Math.abs(ntpMs - Date.now());
  return { status: driftMs < 5000 ? "ok" : "fail", driftMs };
}

async function checkNtp(): Promise<{ status: "ok" | "fail"; driftMs: number | null }> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({ status: "fail", driftMs: null }), 5000);
    try {
      const socket = Bun.udpSocket({
        port: 0,
        socket: {
          data(sock, buf) {
            clearTimeout(timeout);
            try { resolve(parseNtpResponse(Buffer.from(buf))); } catch { resolve({ status: "fail", driftMs: null }); }
            sock.close();
          },
          error() { clearTimeout(timeout); resolve({ status: "fail", driftMs: null }); },
        },
      });
      socket.send(buildNtpPacket(), 123, "pool.ntp.org");
    } catch {
      clearTimeout(timeout);
      resolve({ status: "fail", driftMs: null });
    }
  });
}

async function checkOsResolver(): Promise<{ status: "ok" | "fail"; nameservers: string[] }> {
  try {
    const content = await Bun.file("/etc/resolv.conf").text();
    const nameservers = parseResolvConf(content);
    return { status: nameservers.length > 0 ? "ok" : "fail", nameservers };
  } catch {
    return { status: "fail", nameservers: [] };
  }
}

export async function checkSystem() {
  const timestamp = Date.now();
  const [ntp, resolver] = await Promise.all([checkNtp(), checkOsResolver()]);

  await Promise.all([
    db.insert(ntpChecks).values({ status: ntp.status, driftMs: ntp.driftMs, timestamp }),
    db.insert(osResolverChecks).values({ status: resolver.status, nameservers: JSON.stringify(resolver.nameservers), timestamp }),
  ]);

  return { ntp: { ...ntp, timestamp }, osResolver: { ...resolver, timestamp } };
}
```
- [ ] Run: `bun test backend/src/checkers/system.test.ts` — expect PASS
- [ ] Commit:
```bash
git add backend/src/checkers/system.ts backend/src/checkers/system.test.ts
git commit -m "feat: system.ts checker - NTP sync and OS resolver"
```

---

## Phase 3 — Extend Existing Checkers

### Task 7: Extend `ping.ts` — TCP connect + ping stats

**Files:**
- Modify: `backend/src/checkers/ping.ts`
- Test: `backend/src/checkers/ping.test.ts` (add to existing or create)

- [ ] Write failing test for TCP connect:
```ts
// Add to ping.test.ts (or create if not exists)
import { checkTcpConnect } from "./ping.ts";

describe("checkTcpConnect", () => {
  test("returns result object with status field", async () => {
    const result = await checkTcpConnect("1.1.1.1", 443);
    expect(result).toHaveProperty("status");
    expect(["ok", "timeout", "error"]).toContain(result.status);
  });
});
```
- [ ] Add `checkTcpConnect` to `ping.ts`:
```ts
export async function checkTcpConnect(host: string, port: number): Promise<{ status: "ok"|"timeout"|"error"; latencyMs: number|null }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ status: "timeout", latencyMs: null }), 3000);
    Bun.connect({ hostname: host, port, socket: {
      open(sock) {
        clearTimeout(timer);
        resolve({ status: "ok", latencyMs: Date.now() - start });
        sock.end();
      },
      error() { clearTimeout(timer); resolve({ status: "error", latencyMs: null }); },
    }}).catch(() => { clearTimeout(timer); resolve({ status: "error", latencyMs: null }); });
  });
}
```
- [ ] Add write to `tcp_connect_results` table after running check
- [ ] Add helper `computePingStats(db, minutes)` that queries `ping_results` and returns `{ targets: { [t]: { lossPercent, jitterMs, avgRttMs } } }` — to be used by `/api/status`
- [ ] Run: `bun test backend/src/checkers/ping.test.ts` — expect PASS
- [ ] Commit:
```bash
git add backend/src/checkers/ping.ts backend/src/checkers/ping.test.ts
git commit -m "feat: TCP connect check and ping stats computation"
```

---

### Task 8: Extend `dns.ts` — consistency, NXDOMAIN, hijacking, DoH

**Files:**
- Modify: `backend/src/checkers/dns.ts`
- Test: `backend/src/checkers/dns.test.ts`

- [ ] Write failing tests:
```ts
import { parseDigOutput, checkDnsConsistency, checkNxdomain, checkHijacking } from "./dns.ts";

describe("checkDnsConsistency", () => {
  test("ok when all resolvers return 1.1.1.1", () => {
    const results = [
      { status: "ok", answer: "1.1.1.1" },
      { status: "ok", answer: "1.1.1.1" },
      { status: "ok", answer: "1.1.1.1" },
    ];
    expect(checkDnsConsistency(results)).toBe("ok");
  });
  test("mismatch when answers differ", () => {
    const results = [
      { status: "ok", answer: "1.1.1.1" },
      { status: "ok", answer: "2.2.2.2" },
    ];
    expect(checkDnsConsistency(results)).toBe("mismatch");
  });
});

describe("parseNxdomainStatus", () => {
  test("ok when dig returns NXDOMAIN", () => {
    const out = "status: NXDOMAIN";
    expect(out.includes("NXDOMAIN")).toBe(true);
  });
});
```
- [ ] Implement the extra checks in `dns.ts` — `checkDnsExtras()` function that:
  1. Queries each resolver with `one.one.one.one`, expects A=`1.1.1.1` (consistency + hijacking)
  2. Queries a random `.invalid` domain, expects NXDOMAIN
  3. Fetches `https://cloudflare-dns.com/dns-query?name=one.one.one.one&type=A`, expects answer
- [ ] Write to `dns_extra_checks` table
- [ ] Run: `bun test backend/src/checkers/dns.test.ts` — expect PASS
- [ ] Commit:
```bash
git add backend/src/checkers/dns.ts backend/src/checkers/dns.test.ts
git commit -m "feat: DNS consistency, NXDOMAIN, hijacking, DoH checks"
```

---

### Task 9: Extend `http.ts` — captive portal + redirect check

**Files:**
- Modify: `backend/src/checkers/http.ts`
- Test: `backend/src/checkers/http.test.ts`

- [ ] Write failing tests:
```ts
import { parseCaptivePortalResponse, parseRedirectResponse } from "./http.ts";

describe("parseCaptivePortalResponse", () => {
  test("clean when body is 'success'", () => {
    expect(parseCaptivePortalResponse(200, "success\n")).toBe("clean");
  });
  test("detected when body differs", () => {
    expect(parseCaptivePortalResponse(200, "<html>Login</html>")).toBe("detected");
  });
  test("detected when status is not 200", () => {
    expect(parseCaptivePortalResponse(302, "")).toBe("detected");
  });
});

describe("parseRedirectResponse", () => {
  test("ok when Location is https://", () => {
    expect(parseRedirectResponse(301, "https://google.com")).toBe("ok");
  });
  test("intercepted when Location is not https or missing", () => {
    expect(parseRedirectResponse(200, null)).toBe("intercepted");
  });
});
```
- [ ] Add to `http.ts`:
```ts
export function parseCaptivePortalResponse(status: number, body: string): "clean" | "detected" {
  return status === 200 && body.trim() === "success" ? "clean" : "detected";
}

export function parseRedirectResponse(status: number, location: string | null): "ok" | "intercepted" {
  return (status === 301 || status === 302) && location?.startsWith("https://") ? "ok" : "intercepted";
}
```
  And `checkCaptivePortal()` + `checkHttpRedirect()` functions that fetch and write to DB.
- [ ] Run: `bun test backend/src/checkers/http.test.ts` — expect PASS
- [ ] Commit:
```bash
git add backend/src/checkers/http.ts backend/src/checkers/http.test.ts
git commit -m "feat: captive portal and HTTP redirect checks"
```

---

### Task 10: Extend `misc.ts` — SSL 30d threshold + black hole detection

**Files:**
- Modify: `backend/src/checkers/misc.ts`
- Test: `backend/src/checkers/misc.test.ts`

- [ ] Write failing test:
```ts
import { detectBlackHole } from "./misc.ts";

describe("detectBlackHole", () => {
  test("detects 3 consecutive null hops", () => {
    const hops = [
      { hop: 1, ip: "192.168.1.1", rttMs: 1.2 },
      { hop: 2, ip: null, rttMs: null },
      { hop: 3, ip: null, rttMs: null },
      { hop: 4, ip: null, rttMs: null },
      { hop: 5, ip: "8.8.8.8", rttMs: 10.2 },
    ];
    expect(detectBlackHole(hops)).toBe(true);
  });
  test("no false positive for 2 consecutive nulls", () => {
    const hops = [
      { hop: 1, ip: "192.168.1.1", rttMs: 1 },
      { hop: 2, ip: null, rttMs: null },
      { hop: 3, ip: null, rttMs: null },
      { hop: 4, ip: "8.8.8.8", rttMs: 10 },
    ];
    expect(detectBlackHole(hops)).toBe(false);
  });
});
```
- [ ] Add `detectBlackHole` export to `misc.ts`
- [ ] Change SSL warning threshold from 14 to 30 days
- [ ] Store `has_black_hole` field in `traceroute_results`
- [ ] Run: `bun test backend/src/checkers/misc.test.ts` — expect PASS
- [ ] Commit:
```bash
git add backend/src/checkers/misc.ts backend/src/checkers/misc.test.ts
git commit -m "feat: black hole detection and SSL 30-day threshold"
```

---

### Task 11: Wire new checkers into `scheduler.ts`

**Files:**
- Modify: `backend/src/scheduler.ts`

- [ ] Import and schedule:
  - `checkInterface()` every 30s
  - `checkSystem()` every 5min
  - `checkTcpConnect("1.1.1.1", 443)` every 30s (from ping.ts)
  - `checkDnsExtras()` every 5min (from dns.ts)
  - `checkCaptivePortal()` every 60s (from http.ts)
  - `checkHttpRedirect()` every 60s (from http.ts)
- [ ] Wrap each in try/catch — checkers must never crash the scheduler
- [ ] Broadcast new check results via WebSocket (same pattern as existing checkers)
- [ ] Manual test: `bun run backend/src/index.ts`, wait 30s, hit `http://localhost:3000/api/status` — verify no errors in logs
- [ ] **USER CHECKPOINT:** Open `http://localhost:3000/api/status` in browser. Verify the response JSON includes `interface`, `tcpConnect`, and `ntp` fields.
- [ ] Commit:
```bash
git add backend/src/scheduler.ts
git commit -m "feat: wire new checkers into scheduler"
```

---

## Phase 4 — Extended API

### Task 12: Extend `/api/status` response

**Files:**
- Modify: `backend/src/routes/api.ts`
- Test: `backend/src/routes/api.test.ts`

- [ ] Write failing test using in-memory SQLite:
```ts
// backend/src/routes/api.test.ts
import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

// Helper: create in-memory DB with schema
function createTestApp() {
  const sqlite = new Database(":memory:");
  // Run DDL...
  const db = drizzle(sqlite);
  const app = new Hono();
  // mount api routes with test db
  return { app, db };
}

describe("GET /api/status", () => {
  test("returns 200 with all required fields", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/status");
    expect(res.status).toBe(200);
    const body = await res.json();
    // existing fields
    expect(body).toHaveProperty("ping");
    expect(body).toHaveProperty("dns");
    // new fields
    expect(body).toHaveProperty("interface");
    expect(body).toHaveProperty("tcpConnect");
    expect(body).toHaveProperty("dnsExtra");
    expect(body).toHaveProperty("captivePortal");
    expect(body).toHaveProperty("ntp");
    expect(body).toHaveProperty("osResolver");
    expect(body).toHaveProperty("pingStats");
  });
});
```
- [ ] Run: `bun test backend/src/routes/api.test.ts` — expect FAIL
- [ ] In `api.ts`, extend the `GET /api/status` handler to query all new tables and include them in the response. Pattern matches existing queries (select latest row per table). Also include `pingStats` from `computePingStats(db, 15)`.
  - **Note on `osResolver`:** Stored in `os_resolver_checks` table (see Task 6). In `api.ts` query the latest row: `db.select().from(osResolverChecks).orderBy(desc(osResolverChecks.timestamp)).limit(1)` — same pattern as `ntpChecks`. Parse `nameservers` field with `JSON.parse()`. Returns `null` for the first ~5 min after startup before the first `checkSystem()` run (same null-on-startup behaviour as `dnsExtra`).
- [ ] Run: `bun test backend/src/routes/api.test.ts` — expect PASS
- [ ] Run: `bun test` — ALL tests pass
- [ ] **USER CHECKPOINT:** Restart server, open `/api/status`. Check all new fields are present in JSON.
- [ ] Commit:
```bash
git add backend/src/routes/api.ts backend/src/routes/api.test.ts
git commit -m "feat: extend /api/status with all new check types"
```

---

## Phase 5 — Frontend Logic (Testable)

### Task 13: Update `lib/types.ts`

**Files:**
- Modify: `frontend/src/lib/types.ts`

- [ ] Add all new TypeScript interfaces from `specs/arch.md` section 4 (`InterfaceCheck`, `TcpConnectResult`, `DnsExtraCheck`, `CaptivePortalCheck`, `HttpRedirectCheck`, `NtpCheck`, `OsResolverCheck`, `PingStatsCheck`)
- [ ] Extend `StatusResponse` interface with all new fields
- [ ] Run: `cd frontend && bun run build` — expect 0 TypeScript errors (may need to fix api.ts to match new types)
- [ ] Commit:
```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts
git commit -m "feat: update frontend types for extended API"
```

---

### Task 14: `lib/checks.ts` — 53 check definitions

**Files:**
- Create: `frontend/src/lib/checks.ts`
- Test: `frontend/src/lib/checks.test.ts`

This is the most important file in the frontend. Take time to get it right.

- [ ] Write failing tests first:
```ts
// frontend/src/lib/checks.test.ts
import { describe, test, expect } from "bun:test";
import { CHECKS, LAYERS } from "./checks.ts";
import type { StatusResponse } from "./types.ts";

function emptyStatus(): StatusResponse {
  return {
    ping: [], dns: [], http: [], traceroute: null, speedtest: null,
    publicIp: null, cgnat: null, mtu: null, ipv6: null, dhcp: null,
    ssl: [], networkStats: [], interface: null, tcpConnect: null,
    dnsExtra: null, captivePortal: null, httpRedirect: null,
    ntp: null, osResolver: null, pingStats: null,
  };
}

describe("CHECKS", () => {
  test("has exactly 53 checks", () => {
    expect(CHECKS).toHaveLength(53);
  });

  test("all checks have required fields", () => {
    for (const c of CHECKS) {
      expect(c).toHaveProperty("id");
      expect(c).toHaveProperty("layer");
      expect(c).toHaveProperty("name");
      expect(c).toHaveProperty("description");
      expect([1,2,3,4,5,6,7]).toContain(c.layer);
    }
  });

  test("check #1 interface active: ok when interface status is up", () => {
    const s = { ...emptyStatus(), interface: { interfaceName: "eth0", status: "up" as const, ipv4: null, ipv6LinkLocal: null, gatewayIp: null, gatewayMac: null, connectionType: "dhcp" as const, rxErrors: 0, txErrors: 0, rxDropped: 0, txDropped: 0, timestamp: Date.now() } };
    const check = CHECKS.find(c => c.id === "iface_up")!;
    expect(check.getStatus(s)).toBe("ok");
  });

  test("check #1 interface active: fail when interface status is down", () => {
    const s = { ...emptyStatus(), interface: { interfaceName: "eth0", status: "down" as const, ipv4: null, ipv6LinkLocal: null, gatewayIp: null, gatewayMac: null, connectionType: "unknown" as const, rxErrors: 0, txErrors: 0, rxDropped: 0, txDropped: 0, timestamp: Date.now() } };
    const check = CHECKS.find(c => c.id === "iface_up")!;
    expect(check.getStatus(s)).toBe("fail");
    expect(check.getFix(s)).not.toBeNull();
  });

  test("check #1 returns unknown when no interface data", () => {
    const check = CHECKS.find(c => c.id === "iface_up")!;
    expect(check.getStatus(emptyStatus())).toBe("unknown");
  });
});

describe("LAYERS", () => {
  test("has 7 layers", () => {
    expect(LAYERS).toHaveLength(7);
  });
  test("each layer has checks", () => {
    for (const layer of LAYERS) {
      const layerChecks = CHECKS.filter(c => c.layer === layer.id);
      expect(layerChecks.length).toBeGreaterThan(0);
    }
  });
});
```
- [ ] Run: `bun test frontend/src/lib/checks.test.ts` — expect FAIL
- [ ] Implement `checks.ts` with all 53 checks. Each check maps exactly to the inventory in `specs/design.md` section 4. Use the `CheckDefinition` interface from `specs/arch.md` section 5.

  Key patterns:
  - `getStatus` returns `"unknown"` when the relevant data field in `StatusResponse` is `null`
  - `getStatus` returns `"stale"` when `Date.now() - timestamp > staleAfterMs`
  - `getFix` returns `null` for passing checks, `string[]` with steps for failing checks
  - Check IDs match exactly the IDs in `specs/design.md` §4 check inventory: `iface_up`, `gw_ping`, `ping_8888`, `dns_gw`, etc.

- [ ] Run: `bun test frontend/src/lib/checks.test.ts` — expect PASS
- [ ] Commit:
```bash
git add frontend/src/lib/checks.ts frontend/src/lib/checks.test.ts
git commit -m "feat: 53 check definitions in lib/checks.ts"
```

---

### Task 15: `lib/diagnostics.ts` — 12 diagnostic rules

**Files:**
- Create: `frontend/src/lib/diagnostics.ts`
- Test: `frontend/src/lib/diagnostics.test.ts`

- [ ] Write failing tests for each of the 12 rules from `specs/design.md` section 5:
```ts
// frontend/src/lib/diagnostics.test.ts
import { describe, test, expect } from "bun:test";
import { evaluate } from "./diagnostics.ts";
import type { StatusResponse } from "./types.ts";

function baseStatus(): StatusResponse {
  // All checks passing — no rules should fire
  return {
    ping: [
      { target: "192.168.1.1", targetLabel: "Router", status: "ok", rttMs: 1.2, timestamp: Date.now() },
      { target: "8.8.8.8", targetLabel: "Google", status: "ok", rttMs: 20, timestamp: Date.now() },
      { target: "1.1.1.1", targetLabel: "Cloudflare", status: "ok", rttMs: 18, timestamp: Date.now() },
    ],
    dns: [
      { server: "192.168.1.1", serverLabel: "Router", domain: "one.one.one.one", status: "ok", latencyMs: 8, timestamp: Date.now() },
      { server: "8.8.8.8", serverLabel: "Google", domain: "one.one.one.one", status: "ok", latencyMs: 20, timestamp: Date.now() },
    ],
    http: [
      { url: "https://www.google.com", statusCode: 200, latencyMs: 300, error: null, timestamp: Date.now() },
    ],
    traceroute: null, speedtest: null, publicIp: null,
    cgnat: { id: 1, type: "cgnat", status: "direct", value: null, timestamp: Date.now() },
    mtu: null, ipv6: null, dhcp: null, ssl: [], networkStats: [],
    interface: { interfaceName: "eth0", status: "up", ipv4: "192.168.1.5", ipv6LinkLocal: "fe80::1", gatewayIp: "192.168.1.1", gatewayMac: "aa:bb:cc:dd:ee:ff", connectionType: "dhcp", rxErrors: 0, txErrors: 0, rxDropped: 0, txDropped: 0, timestamp: Date.now() },
    tcpConnect: { host: "1.1.1.1", port: 443, status: "ok", latencyMs: 18, timestamp: Date.now() },
    dnsExtra: { consistency: "ok", nxdomain: "ok", hijacking: "ok", doh: "ok", dnsLeak: "ok", timestamp: Date.now() },
    captivePortal: { status: "clean", timestamp: Date.now() },
    httpRedirect: { status: "ok", timestamp: Date.now() },
    ntp: { status: "ok", driftMs: 30, timestamp: Date.now() },
    osResolver: { status: "ok", nameservers: ["192.168.1.1"], timestamp: Date.now() },
    pingStats: { targets: { "8.8.8.8": { lossPercent: 0, jitterMs: 1.2, avgRttMs: 20 } }, timestamp: Date.now() },
  };
}

describe("evaluate — no rules when healthy", () => {
  test("returns empty array when all checks pass", () => {
    const rules = evaluate(baseStatus());
    expect(rules).toHaveLength(0);
  });
});

describe("R3: ISP outage", () => {
  test("fires when gateway ok but 8.8.8.8 and 1.1.1.1 timeout", () => {
    const s = { ...baseStatus(), ping: [
      { target: "192.168.1.1", targetLabel: "Router", status: "ok" as const, rttMs: 1.2, timestamp: Date.now() },
      { target: "8.8.8.8", targetLabel: "Google", status: "timeout" as const, rttMs: null, timestamp: Date.now() },
      { target: "1.1.1.1", targetLabel: "CF", status: "timeout" as const, rttMs: null, timestamp: Date.now() },
    ]};
    const rules = evaluate(s);
    expect(rules.find(r => r.id === "R3")).toBeDefined();
  });
  test("does NOT fire when gateway also fails (R1/R2 take priority)", () => {
    const s = { ...baseStatus(), ping: [
      { target: "192.168.1.1", targetLabel: "Router", status: "timeout" as const, rttMs: null, timestamp: Date.now() },
      { target: "8.8.8.8", targetLabel: "Google", status: "timeout" as const, rttMs: null, timestamp: Date.now() },
    ]};
    const rules = evaluate(s);
    const r3 = rules.find(r => r.id === "R3");
    expect(r3).toBeUndefined();
  });
});

describe("R7: packet loss", () => {
  test("fires when loss > 5% in last 15 min", () => {
    const s = { ...baseStatus(), pingStats: {
      targets: { "8.8.8.8": { lossPercent: 8.5, jitterMs: 5, avgRttMs: 25 } },
      timestamp: Date.now(),
    }};
    expect(evaluate(s).find(r => r.id === "R7")).toBeDefined();
  });
});

describe("R9: CGNAT", () => {
  test("fires when CGNAT detected", () => {
    const s = { ...baseStatus(), cgnat: { id: 1, type: "cgnat" as const, status: "cgnat", value: null, timestamp: Date.now() } };
    expect(evaluate(s).find(r => r.id === "R9")).toBeDefined();
  });
});
```
- [ ] Run: `bun test frontend/src/lib/diagnostics.test.ts` — expect FAIL
- [ ] Implement `diagnostics.ts` with all 12 rules. Each rule is a `DiagnosticRule` object (interface in `specs/arch.md` section 5). `evaluate()` filters rules where `condition(s)` returns `true`, sorts by severity (critical first).
- [ ] Run: `bun test frontend/src/lib/diagnostics.test.ts` — expect PASS
- [ ] Run: `bun test` — ALL tests pass
- [ ] Commit:
```bash
git add frontend/src/lib/diagnostics.ts frontend/src/lib/diagnostics.test.ts
git commit -m "feat: 12 diagnostic rules in lib/diagnostics.ts"
```

---

## Phase 6 — Frontend Components

### Task 16: `CheckRow.svelte`

**Files:**
- Create: `frontend/src/components/CheckRow.svelte`

- [ ] Implement component accepting props:
```ts
interface Props {
  check: CheckDefinition;
  status: StatusResponse;
}
```
  Renders: status icon (✓/✗/!/?) + name + description + fix block (only when `getStatus() === 'fail'`)
- [ ] Colors: ok=`#22c55e`, fail=`#ef4444`, warn=`#eab308`, stale/unknown=`#4b5563`
- [ ] Run: `cd frontend && bun run build` — 0 errors
- [ ] **USER CHECKPOINT:** Start dev server `cd frontend && bun run dev`. Open `http://localhost:5173`. Add a temporary test render of `<CheckRow>` in App.svelte to verify it looks correct. Remove after verifying.
- [ ] Commit:
```bash
git add frontend/src/components/CheckRow.svelte
git commit -m "feat: CheckRow component"
```

---

### Task 17: `LayerCard.svelte`

**Files:**
- Create: `frontend/src/components/LayerCard.svelte`

- [ ] Props:
```ts
interface Props {
  layer: { id: number; name: string; icon: string };
  checks: CheckDefinition[];
  status: StatusResponse;
  isCascade?: boolean;  // show cascade warning banner
}
```
  Renders: colored left border (green/red/yellow based on any check failing) + header with badge `N/N ✓` or `N errors` + list of `<CheckRow>` for all checks in layer
- [ ] Cascade warning: if `isCascade=true`, show a muted notice `⚠ Likely cascading from an upstream layer issue`
- [ ] Run: `cd frontend && bun run build` — 0 errors
- [ ] Commit:
```bash
git add frontend/src/components/LayerCard.svelte
git commit -m "feat: LayerCard component"
```

---

### Task 18: `DiagBanner.svelte`

**Files:**
- Create: `frontend/src/components/DiagBanner.svelte`

- [ ] Props:
```ts
interface Props {
  rule: DiagnosticRule;
}
```
  Renders: severity icon (🔴/🟡/🔵) + title + description text + numbered steps
- [ ] Style: background tinted by severity (red/yellow/blue tint), border matching severity color
- [ ] Run: `cd frontend && bun run build` — 0 errors
- [ ] Commit:
```bash
git add frontend/src/components/DiagBanner.svelte
git commit -m "feat: DiagBanner component"
```

---

### Task 19: `PathChain.svelte`

**Files:**
- Create: `frontend/src/components/PathChain.svelte`

- [ ] Props:
```ts
interface LayerStatus {
  id: number;
  icon: string;
  name: string;
  failCount: number;
  hasStale: boolean;
}
interface Props {
  layers: LayerStatus[];
  onNodeClick: (layerId: number) => void;
}
```
  Renders: horizontal chain `[🖥 Device] → [📡 Router] → ...`
  - Each node: green border if `failCount=0`, red if `failCount>0` with count badge, grey if `hasStale`
  - Clicking a node scrolls to corresponding layer section
- [ ] Run: `cd frontend && bun run build` — 0 errors
- [ ] Commit:
```bash
git add frontend/src/components/PathChain.svelte
git commit -m "feat: PathChain component"
```

---

### Task 20: `App.svelte` — full rewrite

**Files:**
- Modify: `frontend/src/App.svelte`

- [ ] Replace entire content. Remove all old components (LatencyChart, PacketLossWidget, SpeedtestWidget, TracerouteWidget, NetworkHealthWidget, EventsLog — these files can be deleted).
- [ ] New structure:
```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { wsConnected, onWsEvent } from "./lib/ws.ts";
  import { api } from "./lib/api.ts";
  import { CHECKS, LAYERS } from "./lib/checks.ts";
  import { evaluate } from "./lib/diagnostics.ts";
  import PathChain from "./components/PathChain.svelte";
  import DiagBanner from "./components/DiagBanner.svelte";
  import LayerCard from "./components/LayerCard.svelte";
  import type { StatusResponse } from "./lib/types.ts";

  let status = $state<StatusResponse | null>(null);
  let lastUpdated = $state<number | null>(null);

  // Derive active diagnostic rules
  const activeRules = $derived(status ? evaluate(status) : []);

  // Derive layer statuses for PathChain
  const layerStatuses = $derived(LAYERS.map(layer => {
    const layerChecks = CHECKS.filter(c => c.layer === layer.id);
    const failCount = status
      ? layerChecks.filter(c => c.getStatus(status!) === "fail").length
      : 0;
    const hasStale = status
      ? layerChecks.every(c => ["stale","unknown"].includes(c.getStatus(status!)))
      : true;
    return { ...layer, failCount, hasStale };
  }));

  // Cascade detection: if ISP layer fails, layers 4+ are likely cascading
  function isCascade(layerId: number): boolean {
    if (!status) return false;
    const ispFails = CHECKS.filter(c => c.layer === 3)
      .some(c => c.getStatus(status!) === "fail");
    return ispFails && layerId >= 4;
  }

  async function loadStatus() {
    try {
      status = await api.status();
      lastUpdated = Date.now();
    } catch (e) {
      console.error("Failed to load status", e);
    }
  }

  onMount(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 10_000);
    const unsub = onWsEvent("*", loadStatus);
    return () => { clearInterval(interval); unsub(); };
  });

  function scrollToLayer(layerId: number) {
    document.getElementById(`layer-${layerId}`)?.scrollIntoView({ behavior: "smooth" });
  }
</script>

<div class="app">
  <header>
    <div class="title">📡 Network Monitor</div>
    <div class="header-right">
      {#if lastUpdated}
        <span class="updated">Updated {Math.floor((Date.now() - lastUpdated) / 1000)}s ago</span>
      {/if}
      <div class="ws-badge" class:connected={$wsConnected}>
        {$wsConnected ? "Live" : "Reconnecting..."}
      </div>
    </div>
  </header>

  <div class="path-section">
    <PathChain layers={layerStatuses} onNodeClick={scrollToLayer} />
  </div>

  {#if activeRules.length > 0}
    <div class="diag-section">
      {#each activeRules as rule}
        <DiagBanner {rule} />
      {/each}
    </div>
  {/if}

  <main>
    {#each LAYERS as layer}
      <div id="layer-{layer.id}">
        <LayerCard
          {layer}
          checks={CHECKS.filter(c => c.layer === layer.id)}
          {status}
          isCascade={isCascade(layer.id)}
        />
      </div>
    {/each}
  </main>
</div>
```
- [ ] Remove old component files: `StatusCard.svelte`, `LatencyChart.svelte`, `PacketLossWidget.svelte`, `SpeedtestWidget.svelte`, `TracerouteWidget.svelte`, `NetworkHealthWidget.svelte`, `EventsLog.svelte`
- [ ] Run: `cd frontend && bun run build` — 0 errors
- [ ] Run: `bun test` — ALL backend tests still pass
- [ ] **USER CHECKPOINT:** Start dev server `cd frontend && bun run dev` (backend also running). Open `http://localhost:5173`. Verify: path chain shows at top, layers visible, checks render with correct names. If something's wrong, fix before continuing.
- [ ] Commit:
```bash
git add frontend/src/App.svelte frontend/src/components/
git commit -m "feat: complete frontend redesign - path chain, layers, checks, diagnostics"
```

---

## Phase 7 — Infrastructure

### Task 21: Update Dockerfile

**Files:**
- Modify: `Dockerfile`

- [ ] Add Alpine packages to the runtime stage:
```dockerfile
RUN apk add --no-cache \
    iproute2 \
    iputils \
    bind-tools \
    traceroute
```
- [ ] Add HEALTHCHECK:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost:${PORT:-3000}/api/status > /dev/null || exit 1
```
- [ ] Verify existing multi-stage build still works: `docker build -t test-build .`
- [ ] Commit:
```bash
git add Dockerfile
git commit -m "chore: add network tools to Docker image and healthcheck"
```

---

### Task 22: Update `docker-compose.yml`

**Files:**
- Modify: `docker-compose.yml`

- [ ] Add `restart: unless-stopped`
- [ ] Verify: `docker-compose up --build -d && sleep 5 && curl http://localhost:3000/api/status`
- [ ] **USER CHECKPOINT:** Run `docker-compose up --build -d`. Wait ~30s. Open `http://localhost:3000`. Does the dashboard show all 7 layers? Do checks have data? Any errors in `docker-compose logs`?
- [ ] Commit:
```bash
git add docker-compose.yml
git commit -m "chore: add restart policy to docker-compose"
```

---

### Task 23: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/docker.yml`

- [ ] Create the workflow file using the exact YAML from `specs/arch.md` section 6
- [ ] Verify YAML syntax: `cat .github/workflows/docker.yml | python3 -c "import sys,yaml; yaml.safe_load(sys.stdin)" && echo OK`
- [ ] Commit and push:
```bash
git add .github/workflows/docker.yml
git commit -m "ci: add GitHub Actions Docker build and push workflow"
git push origin main
```
- [ ] **USER CHECKPOINT:** Go to `https://github.com/gpont/home-network-monitor/actions`. Does the workflow appear? Did it trigger on the push? Check for any errors.

---

### Task 24: Final integration test + tag first release

- [ ] Run full test suite: `bun test` — all pass
- [ ] Build check: `cd frontend && bun run build` — 0 errors
- [ ] Docker build: `docker-compose up --build -d`
- [ ] Smoke test: `curl http://localhost:3000/api/status | jq 'keys'` — verify all expected keys
- [ ] **USER CHECKPOINT (final):** Open `http://localhost:3000` in browser. Walk through the dashboard:
  1. Is the path chain at the top with correct node colors?
  2. Are all 7 layers visible and expanded?
  3. Do any diagnostic banners appear (and are they accurate)?
  4. Pick one failing check — does it show the fix instructions?
  5. Check `docker-compose logs` — no errors or crashes?
- [ ] Tag first release:
```bash
git tag v1.0.0
git push origin v1.0.0
```
- [ ] **USER CHECKPOINT:** Go to GitHub Actions. Verify the `v1.0.0` tag triggered a build that pushed `ghcr.io/gpont/home-network-monitor:v1.0.0` and `:latest`.
