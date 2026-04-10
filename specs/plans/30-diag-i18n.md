# T30 — diagnostics.ts: title/description/steps → TranslationKey

**Зависит от:** T26  
**Блокирует:** T32  
**Справочники:** specs/design.md#5-diagnostic-rules, specs/design.md#7-i18n-architecture

---

## Что делаем

Мигрируем `frontend/src/lib/diagnostics.ts`: поля `title`, `description`, `steps[]` → `TranslationKey`. Обновляем тип `DiagnosticRule` в `types.ts`.

## Файлы

- Изменить: `frontend/src/lib/diagnostics.ts`
- Изменить: `frontend/src/lib/types.ts` (поля DiagnosticRule)
- Изменить: `frontend/src/lib/diagnostics.test.ts`

## TDD-шаги

### Шаг 1: обновить DiagnosticRule в types.ts

```typescript
import type { TranslationKey } from './i18n/ru.ts';

interface DiagnosticRule {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  condition: (s: StatusResponse) => boolean;
  title: TranslationKey;        // было: string
  description: TranslationKey;  // было: string
  steps: TranslationKey[];      // было: string[]
}
```

- [ ] Обновить types.ts
- [ ] `bun run typecheck` — FAIL (пока не мигрировано diagnostics.ts)

### Шаг 2: мигрировать все 12 правил (R1-R12)

```typescript
// Было:
{ title: 'Полный обрыв — нет сети', description: 'Пропадание...', steps: ['Проверь...'] }

// Стало:
{ title: 'diag.R1.title', description: 'diag.R1.desc', steps: ['diag.R1.step.0', 'diag.R1.step.1'] }
```

Соответствие ключей:
- R1: `diag.R1.title`, `diag.R1.desc`, `diag.R1.step.0..N`
- R2-R12: аналогично

- [ ] Мигрировать все 12 правил
- [ ] `bun run typecheck` — 0 ошибок

### Шаг 3: обновить тесты

Тесты проверяют логику `condition()` — она не изменилась. Проверить что тесты по-прежнему зелёные.

- [ ] `bun test frontend/src/lib/diagnostics.test.ts` — PASS

## Мануальная проверка (для пользователя)

- [ ] `bun test` — все тесты зелёные
- [ ] `bun run typecheck` — 0 ошибок
