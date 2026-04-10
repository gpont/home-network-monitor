# Scheduler + API (T11–T12)

---

## T11 — Wire new checkers into scheduler.ts

**Зависит от:** T05, T06, T07, T08, T09, T10 (все чекеры Batch 2)
**Блокирует:** T12
**Справочники:** [specs/arch.md](../arch.md) §1 System Overview, §5 Frontend Architecture

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

### Мануальная проверка
- [ ] `bun test` — все тесты зелёные
- [ ] Запусти backend 60 секунд → все чекеры пишут в БД:
  `sqlite3 data/monitor.db "SELECT COUNT(*) FROM interface_checks; SELECT COUNT(*) FROM ntp_checks;"`
- [ ] WebSocket получает события от всех новых чекеров

---

## T12 — Extend /api/status response

**Зависит от:** T11
**Блокирует:** T13
**Справочники:** [specs/arch.md](../arch.md) §4 API Contract /api/status, [specs/design.md](../design.md) §6 Extended Response

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

### Мануальная проверка
- [ ] `curl http://localhost:3000/api/status | jq 'keys'` — видны все ожидаемые поля
- [ ] Ответ содержит все 53 чека согласно specs/design.md §4
- [ ] Все числовые поля не null (значения присутствуют)
