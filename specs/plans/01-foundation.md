# Foundation Tasks (T01–T04)

> Эти задачи последовательны: T01-T03 можно параллелить, T04 после T03.

---

## T01 — MIT License + README

**Зависит от:** —
**Блокирует:** —
**Справочники:** [specs/arch.md](../arch.md) §9 README Structure

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

### Мануальная проверка
- [ ] Файлы `LICENSE` и `README.md` существуют в корне репо
- [ ] `LICENSE` содержит "MIT License", год 2026, автор gpont
- [ ] `README.md` содержит все разделы из specs/arch.md §9

---

## T02 — Extend config.ts

**Зависит от:** —
**Блокирует:** T03 (DB schema читает config), Batch 2
**Справочники:** [specs/arch.md](../arch.md) §12 Configurable Targets

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

### Мануальная проверка
- [ ] `bun test backend/src/config.test.ts` — все тесты зелёные
- [ ] В `.env` файл рядом с docker-compose: задай `PING_TARGETS=1.2.3.4:Test`
- [ ] Запусти `docker-compose up --build -d` → `curl localhost:3000/api/status` — ping к 1.2.3.4 есть

---

## T03 — New DB tables + schema migration

**Зависит от:** T02
**Блокирует:** T04, Batch 2
**Справочники:** [specs/arch.md](../arch.md) §3 Database Schema (New Tables)

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

### Мануальная проверка
- [ ] `bun test backend/src/db/` — все тесты зелёные
- [ ] Запусти backend: `cd backend && bun run src/index.ts` → нет ошибок DDL в логах
- [ ] SQLite файл создаётся, все 15 таблиц видны: `sqlite3 data/monitor.db ".tables"`

---

## T04 — Data retention cleanup job

**Зависит от:** T03
**Блокирует:** Batch 2
**Справочники:** [specs/arch.md](../arch.md) §8 Data Retention

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

### Мануальная проверка
- [ ] `bun test backend/src/db/cleanup.test.ts` — все тесты зелёные
- [ ] Тест проверяет что записи старше retention порога удалены, новые остаются
