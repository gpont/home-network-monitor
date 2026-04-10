# T29 — checks.ts: все строки → TranslationKey + configHint + runnable + status remap

**Зависит от:** T26  
**Блокирует:** T31  
**Справочники:** specs/design.md#33-check-row, specs/design.md#7-i18n-architecture

---

## Что делаем

Мигрируем `frontend/src/lib/checks.ts`: все raw-строки (name, description, getFix(), noDataHint) → `TranslationKey`. Добавляем новые поля `configHint`, `runnable`, `runType`. Ремаппинг бывших `info`-статусов.

## Файлы

- Изменить: `frontend/src/lib/checks.ts`
- Изменить: `frontend/src/lib/types.ts` (новые поля в CheckDefinition)
- Изменить: `frontend/src/lib/checks.test.ts`

## TDD-шаги

### Шаг 1: обновить CheckDefinition в types.ts

```typescript
import type { TranslationKey } from './i18n/ru.ts';

interface CheckDefinition {
  id: string;
  layer: number;
  name: TranslationKey;           // было: string
  description: TranslationKey;    // было: string
  staleAfterMs: number;
  noDataHint?: TranslationKey;    // было: string
  configHint?: TranslationKey[];  // НОВОЕ
  runnable?: boolean;             // НОВОЕ
  runType?: 'speedtest' | 'traceroute' | 'mtu' | 'cgnat' | 'publicip'; // НОВОЕ
  getStatus: (s: StatusResponse) => CheckStatus;
  getValue: (s: StatusResponse) => string | null;
  getFix: (s: StatusResponse) => TranslationKey[] | null; // было: string[] | null
}

// CheckStatus — убрать 'info'
type CheckStatus = 'ok' | 'warn' | 'fail' | 'unknown' | 'stale';
```

- [ ] Обновить types.ts
- [ ] `bun run typecheck` — FAIL (пока не мигрированы checks.ts)

### Шаг 2: status remap — бывшие `info`-чеки

| Чек | Было | Стало |
|---|---|---|
| `iface_speed` | `info` всегда | `ok` если networkStats есть |
| `wan_type` | `info` если тип известен | `ok` если тип известен |
| `isp_dns` | `info` если nameservers есть | `ok` если nameservers есть |
| `iface_ipv6_ll` | `info` если нет адреса | `warn` если нет · `ok` если есть |
| `iface_arp` | `info` если нет MAC | `warn` если нет · `ok` если есть |

- [ ] Написать тесты для каждого remap — FAIL
- [ ] Обновить `getStatus()` в checks.ts
- [ ] `bun test` — PASS

### Шаг 3: мигрировать name/description/getFix/noDataHint → TranslationKey

Для каждого из 53 чеков заменить строки на ключи:

```typescript
// Было:
{ name: 'Интерфейс активен', description: 'Сетевой адаптер...', getFix: () => ['Проверь...'] }

// Стало:
{ name: 'check.iface_up.name', description: 'check.iface_up.desc', getFix: () => ['check.iface_up.fix.0'] }
```

- [ ] Мигрировать все 53 чека
- [ ] `bun run typecheck` — 0 ошибок
- [ ] `bun test backend` — тесты чекеров не затронуты, зелёные

### Шаг 4: добавить configHint + runnable + runType

Чеки, требующие настройки перед первым запуском (пример):
```typescript
{ id: 'gw_ping', configHint: ['check.gw_ping.config.0', 'check.gw_ping.config.1'] }
```

Чеки с кнопкой "Run now":
```typescript
{ id: 'speedtest', runnable: true, runType: 'speedtest' }
{ id: 'route_stable', runnable: true, runType: 'traceroute' }
{ id: 'no_blackhole', runnable: true, runType: 'traceroute' }
{ id: 'isp_hop', runnable: true, runType: 'traceroute' }
{ id: 'isp_hop_rtt', runnable: true, runType: 'traceroute' }
{ id: 'gw_mtu', runnable: true, runType: 'mtu' }
{ id: 'cgnat', runnable: true, runType: 'cgnat' }
{ id: 'public_ip', runnable: true, runType: 'publicip' }
```

- [ ] Добавить поля
- [ ] Написать тест: `speedtest` check имеет `runnable: true`, `runType: 'speedtest'`
- [ ] `bun test` — PASS

## Мануальная проверка (для пользователя)

- [ ] `bun test` — все тесты зелёные
- [ ] `bun run typecheck` — 0 ошибок
