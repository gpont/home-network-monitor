# T19 — PathChain.svelte

**Зависит от:** T13 (lib/types.ts)
**Блокирует:** T20
**Справочники:** [specs/design.md](../design.md) §3.2 Path Chain

---

## Что делаем

Создаём компонент `PathChain.svelte` — горизонтальную цепочку узлов пути пакета. Каждый узел представляет слой сети (Device → Router → ISP → ...) и окрашивается по статусу: зелёный если нет ошибок, красный с бейджем количества ошибок, серый если данные устарели. Клик по узлу прокручивает страницу к соответствующей карточке слоя.

## Файлы
- Создать: `frontend/src/components/PathChain.svelte`

- [ ] Props:
```ts
interface LayerStatus {
  id: number;
  icon: string;
  name: string;
  failCount: number;
  hasStale: boolean;
}
interface Props {
  layers: LayerStatus[];
  onNodeClick: (layerId: number) => void;
}
```
  Renders: horizontal chain `[🖥 Device] → [📡 Router] → ...`
  - Each node: green border if `failCount=0`, red if `failCount>0` with count badge, grey if `hasStale`
  - Clicking a node scrolls to corresponding layer section
- [ ] Run: `cd frontend && bun run build` — 0 errors
- [ ] Commit:
```bash
git add frontend/src/components/PathChain.svelte
git commit -m "feat: PathChain component"
```

---

## Мануальная проверка
- [ ] `cd frontend && bun run build` — сборка без ошибок
- [ ] Открой `http://localhost:3000` (или `cd frontend && bun run dev`)
- [ ] PathChain отображается как горизонтальная цепочка узлов вверху страницы
- [ ] Узлы окрашены по статусу: зелёный/красный с бейджем/серый
- [ ] Клик по узлу прокручивает страницу к соответствующей LayerCard
