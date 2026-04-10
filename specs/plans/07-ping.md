# T07 — Extend ping.ts checker

**Зависит от:** T04
**Блокирует:** T11
**Справочники:** [specs/arch.md](../arch.md) §3 New Tables (tcp_connect_results),
                [specs/design.md](../design.md) §4 Layer 2 — Gateway/Local

---

## Что делаем
Расширяем существующий `ping.ts`: добавляем TCP connect check (подключение к `1.1.1.1:443` через `Bun.connect`), запись результатов в таблицу `tcp_connect_results`, а также вспомогательную функцию `computePingStats` для подсчёта jitter и packet loss по истории из БД — эти данные будут использованы в `/api/status`.

## Файлы
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

## Мануальная проверка
- [ ] `bun test backend/src/checkers/ping.test.ts` — все тесты зелёные
- [ ] Открой `http://localhost:3000/api/status` → поля `ping.tcpConnect`, `ping.jitter` присутствуют
- [ ] Данные выглядят правильно (не null, не undefined)
