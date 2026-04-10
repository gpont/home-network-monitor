# T18 — DiagBanner.svelte

**Зависит от:** T13 (lib/types.ts)
**Блокирует:** T20
**Справочники:** [specs/design.md](../design.md) §3.5 Diagnostic Banners

---

## Что делаем

Создаём компонент `DiagBanner.svelte` — диагностический баннер с описанием выявленной проблемы. Отображает иконку severity, заголовок, описание и пронумерованные шаги по устранению. Фон и рамка окрашиваются по уровню серьёзности (красный/жёлтый/синий).

## Файлы
- Создать: `frontend/src/components/DiagBanner.svelte`

- [ ] Props:
```ts
interface Props {
  rule: DiagnosticRule;
}
```
  Renders: severity icon (🔴/🟡/🔵) + title + description text + numbered steps
- [ ] Style: background tinted by severity (red/yellow/blue tint), border matching severity color
- [ ] Run: `cd frontend && bun run build` — 0 errors
- [ ] Commit:
```bash
git add frontend/src/components/DiagBanner.svelte
git commit -m "feat: DiagBanner component"
```

---

## Мануальная проверка
- [ ] `cd frontend && bun run build` — сборка без ошибок
- [ ] Открой `http://localhost:3000` (или `cd frontend && bun run dev`)
- [ ] DiagBanner отображается с иконкой severity и заголовком
- [ ] Пронумерованные шаги видны в баннере
- [ ] Фон и рамка соответствуют уровню серьёзности (красный/жёлтый/синий)
