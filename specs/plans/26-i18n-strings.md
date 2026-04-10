# T26 — ru.ts + en.ts: все ~500 ключей + LangSwitcher

**Зависит от:** T25  
**Блокирует:** T29, T30  
**Справочники:** specs/design.md#7-i18n-architecture, specs/design.md#4-check-inventory, specs/design.md#5-diagnostic-rules

---

## Что делаем

Заполняем `ru.ts` и `en.ts` полным набором ключей: UI-строки, 53 чека (name, desc, fix.*, noData, config.*), 12 диагностических правил (title, desc, step.*). Создаём `LangSwitcher.svelte`.

## Файлы

- Изменить: `frontend/src/lib/i18n/ru.ts`
- Изменить: `frontend/src/lib/i18n/en.ts`
- Создать: `frontend/src/components/LangSwitcher.svelte`

## TDD-шаги

### Шаг 1: UI-ключи (ru.ts)

Добавить в `ru.ts` все UI-ключи согласно таблице в specs/design.md §7:

```typescript
// Ключи которые нужны (минимально для работы компонентов):
'ui.live', 'ui.reconnecting', 'ui.updated', 'ui.loading',
'ui.what_to_do', 'ui.cascade_warning',
'ui.run_now', 'ui.running', 'ui.already_running',
'ui.needs_config', 'ui.data_in', 'ui.data_stale',
// Layer names:
'layer.1.name', 'layer.2.name', ..., 'layer.7.name',
// Per-check keys (53 × 4+ = ~250+ ключей):
'check.<id>.name', 'check.<id>.desc',
'check.<id>.fix.0', ...  // только при наличии fix
'check.<id>.noData',     // только если noDataHint задан
'check.<id>.config.0',  // только если configHint задан
// Diagnostics (12 × 4+ = ~60+ ключей):
'diag.R1.title', 'diag.R1.desc', 'diag.R1.step.0', ...
```

- [ ] Добавить ключи в `ru.ts`
- [ ] `bun run typecheck` — 0 ошибок

### Шаг 2: en.ts

Добавить все те же ключи по-английски в `en.ts` (типизируется как `Record<TranslationKey, string>` — TS-ошибка при пропуске).

- [ ] Добавить ключи в `en.ts`
- [ ] `bun run typecheck` — 0 ошибок (en.ts должен покрывать все ключи из ru.ts)

### Шаг 3: LangSwitcher.svelte

```svelte
<script lang="ts">
  import { locale, type Locale } from '../lib/i18n/index.ts';
  function set(l: Locale) { locale.set(l); }
</script>

<div class="lang-switcher">
  <button class:active={$locale === 'ru'} onclick={() => set('ru')}>🇷🇺 RU</button>
  <button class:active={$locale === 'en'} onclick={() => set('en')}>🇬🇧 EN</button>
</div>
```

- [ ] Создать компонент
- [ ] `cd frontend && bun run build` — без ошибок

## Мануальная проверка (для пользователя)

- [ ] `bun run typecheck` — 0 ошибок
- [ ] `cd frontend && bun run build` — сборка без ошибок
