# T32 — DiagBanner + LayerCard + App.svelte: $t() завершение + LangSwitcher

**Зависит от:** T30, T29  
**Блокирует:** —  
**Справочники:** specs/design.md#34-layer-card, specs/design.md#35-diagnostic-banners, specs/design.md#7-i18n-architecture

---

## Что делаем

Финальная i18n-интеграция: `DiagBanner.svelte`, `LayerCard.svelte` и `App.svelte` переходят на `$t()`. `LangSwitcher` встраивается в header. После этого всё приложение поддерживает двуязычность.

## Файлы

- Изменить: `frontend/src/components/DiagBanner.svelte`
- Изменить: `frontend/src/components/LayerCard.svelte`
- Изменить: `frontend/src/App.svelte`
- Использовать: `frontend/src/components/LangSwitcher.svelte` (создан в T26)

## Шаги

### DiagBanner.svelte

Заменить:
- `rule.title` → `$t(rule.title)`
- `rule.description` → `$t(rule.description)`
- `rule.steps[i]` → `$t(rule.steps[i])`

### LayerCard.svelte

Заменить:
- Название слоя → `$t(layer.name)` (ключ `layer.<n>.name`)
- Каскадное предупреждение → `$t('ui.cascade_warning')`

### App.svelte

Заменить все raw UI-строки на `$t(...)`. Добавить `LangSwitcher` в header:

```svelte
<header>
  <h1>{$t('ui.title')}</h1>
  <span>{$t('ui.updated', { n: secondsAgo })}</span>
  <LangSwitcher />
  <span class="ws-badge">{$t('ui.live')}</span>
</header>
```

## Проверка

- [ ] `cd frontend && bun run build` — без ошибок
- [ ] `bun run typecheck` — 0 ошибок

## Мануальная проверка (для пользователя)

- [ ] Открыть `http://localhost:3000` — дашборд на RU
- [ ] Нажать EN-кнопку в header → весь UI мгновенно переходит на английский
- [ ] Обновить страницу → язык сохранился (localStorage)
- [ ] RU кнопка → возврат на русский
- [ ] Все названия чеков, описания, fix-шаги и диагностические баннеры переведены
