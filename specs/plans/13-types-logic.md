# Frontend Logic (T13–T15)

> T13 → T14 → T15 строго последовательны.

---

## T13 — Update lib/types.ts

**Зависит от:** T12
**Блокирует:** T14, T16, T18, T19
**Справочники:** [specs/arch.md](../arch.md) §4 API Contract /api/status, §5 Frontend Architecture

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

### Мануальная проверка
- [ ] `bun run typecheck` — 0 ошибок TypeScript
- [ ] Все поля из /api/status ответа типизированы

---

## T14 — lib/checks.ts — 53 check definitions

**Зависит от:** T13
**Блокирует:** T15, T20
**Справочники:** [specs/design.md](../design.md) §4 Check Inventory (53 чека), §3 UI Layout

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

### Мануальная проверка
- [ ] `bun test frontend/src/lib/checks.test.ts` — все тесты зелёные
- [ ] Для каждого из 53 чеков: getStatus() возвращает 'ok' | 'warn' | 'fail' | 'unknown'
- [ ] getValue() возвращает строку (не undefined)

---

## T15 — lib/diagnostics.ts — 12 diagnostic rules

**Зависит от:** T14
**Блокирует:** T20
**Справочники:** [specs/design.md](../design.md) §5 Diagnostic Rules

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

### Мануальная проверка
- [ ] `bun test frontend/src/lib/diagnostics.test.ts` — все тесты зелёные
- [ ] Каждое из 12 правил протестировано: trigger condition + non-trigger condition
- [ ] evaluate() возвращает DiagnosticResult[] с правильными severity
