# T20 — App.svelte — full rewrite

**Зависит от:** T14 (lib/checks.ts), T15 (lib/diagnostics.ts), T16 (CheckRow.svelte), T17 (LayerCard.svelte), T18 (DiagBanner.svelte), T19 (PathChain.svelte)
**Блокирует:** T24
**Справочники:** [specs/design.md](../design.md) §3.1 Full Page

---

## Что делаем

Полностью переписываем `App.svelte` — главный дашборд. Удаляем все старые компоненты (LatencyChart, PacketLossWidget и др.), заменяем на новую структуру: PathChain вверху, DiagBanner-ы с диагностикой, список LayerCard-ов с чеками. Данные загружаются через API и обновляются в реальном времени по WebSocket.

## Файлы
- Изменить: `frontend/src/App.svelte`

- [ ] Replace entire content. Remove all old components (LatencyChart, PacketLossWidget, SpeedtestWidget, TracerouteWidget, NetworkHealthWidget, EventsLog — these files can be deleted).
- [ ] New structure:
```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { wsConnected, onWsEvent } from "./lib/ws.ts";
  import { api } from "./lib/api.ts";
  import { CHECKS, LAYERS } from "./lib/checks.ts";
  import { evaluate } from "./lib/diagnostics.ts";
  import PathChain from "./components/PathChain.svelte";
  import DiagBanner from "./components/DiagBanner.svelte";
  import LayerCard from "./components/LayerCard.svelte";
  import type { StatusResponse } from "./lib/types.ts";

  let status = $state<StatusResponse | null>(null);
  let lastUpdated = $state<number | null>(null);

  // Derive active diagnostic rules
  const activeRules = $derived(status ? evaluate(status) : []);

  // Derive layer statuses for PathChain
  const layerStatuses = $derived(LAYERS.map(layer => {
    const layerChecks = CHECKS.filter(c => c.layer === layer.id);
    const failCount = status
      ? layerChecks.filter(c => c.getStatus(status!) === "fail").length
      : 0;
    const hasStale = status
      ? layerChecks.every(c => ["stale","unknown"].includes(c.getStatus(status!)))
      : true;
    return { ...layer, failCount, hasStale };
  }));

  // Cascade detection: if ISP layer fails, layers 4+ are likely cascading
  function isCascade(layerId: number): boolean {
    if (!status) return false;
    const ispFails = CHECKS.filter(c => c.layer === 3)
      .some(c => c.getStatus(status!) === "fail");
    return ispFails && layerId >= 4;
  }

  async function loadStatus() {
    try {
      status = await api.status();
      lastUpdated = Date.now();
    } catch (e) {
      console.error("Failed to load status", e);
    }
  }

  onMount(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 10_000);
    const unsub = onWsEvent("*", loadStatus);
    return () => { clearInterval(interval); unsub(); };
  });

  function scrollToLayer(layerId: number) {
    document.getElementById(`layer-${layerId}`)?.scrollIntoView({ behavior: "smooth" });
  }
</script>

<div class="app">
  <header>
    <div class="title">📡 Network Monitor</div>
    <div class="header-right">
      {#if lastUpdated}
        <span class="updated">Updated {Math.floor((Date.now() - lastUpdated) / 1000)}s ago</span>
      {/if}
      <div class="ws-badge" class:connected={$wsConnected}>
        {$wsConnected ? "Live" : "Reconnecting..."}
      </div>
    </div>
  </header>

  <div class="path-section">
    <PathChain layers={layerStatuses} onNodeClick={scrollToLayer} />
  </div>

  {#if activeRules.length > 0}
    <div class="diag-section">
      {#each activeRules as rule}
        <DiagBanner {rule} />
      {/each}
    </div>
  {/if}

  <main>
    {#each LAYERS as layer}
      <div id="layer-{layer.id}">
        <LayerCard
          {layer}
          checks={CHECKS.filter(c => c.layer === layer.id)}
          {status}
          isCascade={isCascade(layer.id)}
        />
      </div>
    {/each}
  </main>
</div>
```
- [ ] Remove old component files: `StatusCard.svelte`, `LatencyChart.svelte`, `PacketLossWidget.svelte`, `SpeedtestWidget.svelte`, `TracerouteWidget.svelte`, `NetworkHealthWidget.svelte`, `EventsLog.svelte`
- [ ] Run: `cd frontend && bun run build` — 0 errors
- [ ] Run: `bun test` — ALL backend tests still pass
- [ ] **USER CHECKPOINT:** Start dev server `cd frontend && bun run dev` (backend also running). Open `http://localhost:5173`. Verify: path chain shows at top, layers visible, checks render with correct names. If something's wrong, fix before continuing.
- [ ] Commit:
```bash
git add frontend/src/App.svelte frontend/src/components/
git commit -m "feat: complete frontend redesign - path chain, layers, checks, diagnostics"
```

---

## Мануальная проверка
- [ ] `cd frontend && bun run build` — сборка без ошибок
- [ ] Открой `http://localhost:3000`
- [ ] PathChain отображается вверху с цветными узлами
- [ ] 7 LayerCard-ов видны, каждый показывает чеки
- [ ] Если есть проблемы — DiagBanner(ы) показываются над картами
- [ ] Live-индикатор в хедере обновляется по WebSocket
