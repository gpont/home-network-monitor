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

  const activeRules = $derived(status ? evaluate(status) : []);

  const layerStatuses = $derived(LAYERS.map(layer => {
    const layerChecks = CHECKS.filter(c => c.layer === layer.id);
    const failCount = status
      ? layerChecks.filter(c => c.getStatus(status!) === "fail").length
      : 0;
    const hasStale = !status || layerChecks.every(c => ["stale", "unknown"].includes(c.getStatus(status!)));
    return { ...layer, failCount, hasStale };
  }));

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
    <div class="legend">
      <span class="legend-item"><span class="dot ok"></span>OK — проверка пройдена</span>
      <span class="legend-item"><span class="dot fail"></span>Ошибка — требует внимания</span>
      <span class="legend-item"><span class="dot warn"></span>Предупреждение</span>
      <span class="legend-item"><span class="dot info"></span>Информация (без критериев)</span>
      <span class="legend-item"><span class="dot nodata"></span>Нет данных</span>
    </div>
  </div>

  {#if activeRules.length > 0}
    <div class="diag-section">
      {#each activeRules as rule}
        <DiagBanner {rule} />
      {/each}
    </div>
  {/if}

  <main>
    {#if status}
      {#each LAYERS as layer}
        <LayerCard
          {layer}
          checks={CHECKS.filter(c => c.layer === layer.id)}
          status={status}
          isCascade={isCascade(layer.id)}
        />
      {/each}
    {:else}
      <div class="loading">Loading...</div>
    {/if}
  </main>
</div>

<style>
  :global(*) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    background: #13141f;
    color: #f1f5f9;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }

  :global(::-webkit-scrollbar) {
    width: 6px;
    height: 6px;
  }

  :global(::-webkit-scrollbar-track) { background: #1e2030; }
  :global(::-webkit-scrollbar-thumb) { background: #2a2d3e; border-radius: 3px; }

  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 24px;
    background: #1e2030;
    border-bottom: 1px solid #2a2d3e;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .title {
    font-size: 16px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .updated { font-size: 12px; color: #4b5563; }

  .ws-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 9999px;
    background: #374151;
    color: #6b7280;
  }

  .ws-badge.connected {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  .path-section {
    padding: 8px 24px 0;
    max-width: 1400px;
    width: 100%;
    margin: 0 auto;
  }

  .diag-section {
    padding: 8px 24px;
    max-width: 1400px;
    width: 100%;
    margin: 0 auto;
  }

  main {
    flex: 1;
    padding: 16px 24px 24px;
    display: flex;
    flex-direction: column;
    max-width: 1400px;
    width: 100%;
    margin: 0 auto;
  }

  .loading {
    color: #64748b;
    font-size: 14px;
    padding: 32px;
    text-align: center;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 4px 0 8px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #4b5563;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .dot.ok    { background: #22c55e; }
  .dot.fail  { background: #ef4444; }
  .dot.warn  { background: #eab308; }
  .dot.info  { background: #3b82f6; }
  .dot.nodata { background: #4b5563; }

  @media (max-width: 900px) {
    main { padding: 12px 16px 16px; }
    .path-section, .diag-section { padding-left: 16px; padding-right: 16px; }
  }
</style>
