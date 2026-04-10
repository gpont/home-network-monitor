# T17 — LayerCard.svelte

**Зависит от:** T16 (CheckRow.svelte)
**Блокирует:** T20
**Справочники:** [specs/design.md](../design.md) §3.4 Layer Card

---

## Что делаем

Создаём компонент `LayerCard.svelte` — карточку одного слоя сети. Отображает цветную левую рамку, заголовок с бейджем (количество ок/ошибок), список `<CheckRow>` для всех чеков слоя и опциональное предупреждение о каскадных проблемах.

## Файлы
- Создать: `frontend/src/components/LayerCard.svelte`

- [ ] Props:
```ts
interface Props {
  layer: { id: number; name: string; icon: string };
  checks: CheckDefinition[];
  status: StatusResponse;
  isCascade?: boolean;  // show cascade warning banner
}
```
  Renders: colored left border (green/red/yellow based on any check failing) + header with badge `N/N ✓` or `N errors` + list of `<CheckRow>` for all checks in layer
- [ ] Cascade warning: if `isCascade=true`, show a muted notice `⚠ Likely cascading from an upstream layer issue`
- [ ] Run: `cd frontend && bun run build` — 0 errors
- [ ] Commit:
```bash
git add frontend/src/components/LayerCard.svelte
git commit -m "feat: LayerCard component"
```

---

## Мануальная проверка
- [ ] `cd frontend && bun run build` — сборка без ошибок
- [ ] Открой `http://localhost:3000` (или `cd frontend && bun run dev`)
- [ ] LayerCard отображается с цветной левой рамкой и заголовком
- [ ] Бейдж показывает корректное количество ок/ошибок
- [ ] Список CheckRow внутри карточки отображается
- [ ] При `isCascade=true`: виден баннер с предупреждением о каскадной проблеме
