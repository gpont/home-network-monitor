# T16 — CheckRow.svelte

**Зависит от:** T13 (lib/types.ts)
**Блокирует:** T17, T20
**Справочники:** [specs/design.md](../design.md) §3.3 Check Row

---

## Что делаем

Создаём компонент `CheckRow.svelte` — строку одного чека в карточке слоя. Отображает иконку статуса, название, описание и блок с инструкцией «Что делать» при FAIL. Цвета статусов: ok=зелёный, fail=красный, warn=жёлтый, stale/unknown=серый.

## Файлы
- Создать: `frontend/src/components/CheckRow.svelte`

- [ ] Implement component accepting props:
```ts
interface Props {
  check: CheckDefinition;
  status: StatusResponse;
}
```
  Renders: status icon (✓/✗/!/?) + name + description + fix block (only when `getStatus() === 'fail'`)
- [ ] Colors: ok=`#22c55e`, fail=`#ef4444`, warn=`#eab308`, stale/unknown=`#4b5563`
- [ ] Run: `cd frontend && bun run build` — 0 errors
- [ ] **USER CHECKPOINT:** Start dev server `cd frontend && bun run dev`. Open `http://localhost:5173`. Add a temporary test render of `<CheckRow>` in App.svelte to verify it looks correct. Remove after verifying.
- [ ] Commit:
```bash
git add frontend/src/components/CheckRow.svelte
git commit -m "feat: CheckRow component"
```

---

## Мануальная проверка
- [ ] `cd frontend && bun run build` — сборка без ошибок
- [ ] Открой `http://localhost:3000` (или `cd frontend && bun run dev`)
- [ ] CheckRow отображается для каждого чека: иконка ✓/✗/⚠/? + текст
- [ ] При FAIL-чеке: виден блок с инструкцией "Что делать"
