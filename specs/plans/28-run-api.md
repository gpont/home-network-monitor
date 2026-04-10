# T28 — Manual Trigger API: POST /api/run/:type

**Зависит от:** T12  
**Блокирует:** T31  
**Справочники:** specs/design.md#62-manual-trigger-api

---

## Что делаем

Добавляем endpoint `POST /api/run/:type` в `routes/api.ts`. Запускает чекер немедленно вне расписания. Защита от повторного запуска: 409 Conflict если чекер уже выполняется.

## Файлы

- Изменить: `backend/src/routes/api.ts`
- Изменить: `backend/src/routes/api.test.ts`
- Изменить: `backend/src/scheduler.ts` (добавить in-flight guard + runOnce-функции)

## TDD-шаги

### Шаг 1: in-flight guard в scheduler.ts

```typescript
// Добавить Map для отслеживания выполняющихся чекеров:
const running = new Set<string>();

export async function runCheckerOnce(type: string, db: Database): Promise<void> {
  if (running.has(type)) throw new AlreadyRunningError(type);
  running.add(type);
  try {
    // запустить соответствующий чекер и сохранить результат
  } finally {
    running.delete(type);
  }
}
```

Валидные типы: `speedtest | traceroute | mtu | cgnat | publicip`

- [ ] Написать тест: повторный вызов → AlreadyRunningError — FAIL
- [ ] Реализовать guard
- [ ] `bun test backend/src/routes/api.test.ts` — PASS

### Шаг 2: endpoint в api.ts

```typescript
app.post('/api/run/:type', async (c) => {
  const type = c.req.param('type');
  const valid = ['speedtest', 'traceroute', 'mtu', 'cgnat', 'publicip'];
  if (!valid.includes(type)) return c.json({ error: 'unknown type' }, 400);
  try {
    await runCheckerOnce(type, db);
    return c.json({ ok: true });
  } catch (e) {
    if (e instanceof AlreadyRunningError) return c.json({ error: 'already running' }, 409);
    throw e;
  }
});
```

- [ ] Написать тест: POST /api/run/speedtest → 200 `{ ok: true }` — FAIL
- [ ] Написать тест: второй POST пока первый выполняется → 409 — FAIL
- [ ] Написать тест: POST /api/run/unknown → 400 — FAIL
- [ ] Реализовать endpoint
- [ ] `bun test` — PASS

## Мануальная проверка (для пользователя)

- [ ] `bun test` — все тесты зелёные
- [ ] `bun run typecheck` — 0 ошибок
- [ ] Запустить сервер, выполнить `curl -X POST http://localhost:3000/api/run/publicip` → `{ "ok": true }`
- [ ] Немедленно повторить запрос → `{ "error": "already running" }` + 409
