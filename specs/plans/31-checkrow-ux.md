# T31 — CheckRow.svelte: $t() + configHint needs_config + кнопка Run now

**Зависит от:** T29, T28  
**Блокирует:** —  
**Справочники:** specs/design.md#33-check-row

---

## Что делаем

Обновляем `CheckRow.svelte`: все тексты через `$t()`, новая логика для `configHint` (жёлтый блок), кнопка "Run now" для `runnable`-чеков, разные тексты для `unknown` vs `stale`.

## Файлы

- Изменить: `frontend/src/components/CheckRow.svelte`
- Изменить: `frontend/src/lib/api.ts` (добавить `runChecker(type)`)

## Реализация

### Логика рендеринга по статусу

```svelte
{#if status === 'fail' && fix}
  <!-- красный блок с fix-шагами через $t() -->
  {#each fix as key, i}
    <div class="fix-step">{i+1}. {$t(key)}</div>
  {/each}
{:else if (status === 'unknown' || status === 'warn') && check.configHint}
  <!-- жёлтый блок needs_config -->
  <div class="config-hint">
    <strong>{$t('ui.needs_config')}</strong>
    {#each check.configHint as key, i}
      <div>{i+1}. {$t(key)}</div>
    {/each}
  </div>
{:else if status === 'unknown'}
  <em class="no-data">{$t(check.noDataHint ?? 'ui.data_in', { n })}</em>
{:else if status === 'stale'}
  <em class="no-data">{$t('ui.data_stale', { n: minutesStale })}</em>
{/if}
```

Где `n = Math.round(check.staleAfterMs / 3 / 60000)`.

### Кнопка Run now

```svelte
{#if (status === 'unknown' || status === 'stale') && check.runnable}
  <button
    disabled={running}
    onclick={handleRun}
  >
    {running ? $t('ui.running') : alreadyRunning ? $t('ui.already_running') : $t('ui.run_now')}
  </button>
{/if}
```

```typescript
async function handleRun() {
  running = true; alreadyRunning = false;
  const res = await fetch(`/api/run/${check.runType}`, { method: 'POST' });
  if (res.status === 409) { alreadyRunning = true; running = false; }
  // иначе ждём WebSocket обновления
}
```

### Убрать `info` из statusColor/statusIcon map

Удалить `info` из map-объектов в `CheckRow.svelte`.

## Шаги

- [ ] Добавить `runChecker(type)` в `frontend/src/lib/api.ts`
- [ ] Обновить `CheckRow.svelte`: логика статусов + $t() + Run now кнопка
- [ ] Убрать `info` из statusColor и statusIcon maps
- [ ] `cd frontend && bun run build` — без ошибок
- [ ] `bun run typecheck` — 0 ошибок

## Мануальная проверка (для пользователя)

- [ ] Открыть `http://localhost:3000`
- [ ] Найти чек speedtest с `unknown` статусом → видна кнопка "▶ Запустить сейчас"
- [ ] Нажать → кнопка показывает "запускается...", через некоторое время исчезает и появляется результат
- [ ] Переключить язык (LangSwitcher после T32) → все тексты меняются
- [ ] Нет чеков с синим/info статусом
