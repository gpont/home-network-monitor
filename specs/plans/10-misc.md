# T10 — Extend misc.ts checker

**Зависит от:** T04
**Блокирует:** T11
**Справочники:** [specs/arch.md](../arch.md) §3 New Tables (misc_checks),
                [specs/design.md](../design.md) §4 Layer 7 — Security/Advanced

---

## Что делаем
Расширяем существующий `misc.ts`: добавляем экспортируемую функцию `detectBlackHole` (3+ последовательных null-хопа в traceroute), увеличиваем порог предупреждения SSL с 14 до 30 дней, и сохраняем поле `has_black_hole` в таблицу `traceroute_results`.

## Файлы
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

## Мануальная проверка
- [ ] `bun test backend/src/checkers/misc.test.ts` — все тесты зелёные
- [ ] Открой `http://localhost:3000/api/status` → поля `misc.ssl`, `misc.blackHole` присутствуют
- [ ] Данные выглядят правильно (не null, не undefined)
