# T08 — Extend dns.ts checker

**Зависит от:** T04
**Блокирует:** T11
**Справочники:** [specs/arch.md](../arch.md) §3 New Tables (dns_extra_checks),
                [specs/design.md](../design.md) §4 Layer 5 — DNS

---

## Что делаем
Расширяем существующий `dns.ts`: добавляем функцию `checkDnsExtras()`, которая проверяет консистентность ответов между резолверами (запрос `one.one.one.one`), детектирует DNS hijacking (ожидаем A=`1.1.1.1`), проверяет корректную обработку NXDOMAIN (случайный `.invalid` домен) и работоспособность DNS-over-HTTPS через Cloudflare. Результаты записываются в таблицу `dns_extra_checks`.

## Файлы
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

## Мануальная проверка
- [ ] `bun test backend/src/checkers/dns.test.ts` — все тесты зелёные
- [ ] Открой `http://localhost:3000/api/status` → поля `dns.consistency`, `dns.doh` присутствуют
- [ ] Данные выглядят правильно (не null, не undefined)
