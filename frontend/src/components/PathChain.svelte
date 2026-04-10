<script lang="ts">
  import { t } from '../lib/i18n/index.ts';

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

  let { layers, onNodeClick }: Props = $props();

  function nodeStyle(layer: LayerStatus): string {
    if (layer.failCount > 0) {
      return 'border: 2px solid #ef4444; background: rgba(239,68,68,0.12);';
    }
    if (layer.hasStale) {
      return 'border: 2px solid #4b5563; background: rgba(75,85,99,0.12);';
    }
    return 'border: 2px solid #22c55e; background: rgba(34,197,94,0.12);';
  }

  function badgeColor(layer: LayerStatus): string {
    return layer.failCount > 0 ? '#ef4444' : '#22c55e';
  }
</script>

<div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap; padding: 8px 0;">
  {#each layers as layer, i}
    <button
      onclick={() => onNodeClick(layer.id)}
      style="
        display: flex; align-items: center; gap: 4px;
        padding: 6px 12px; border-radius: 20px; cursor: pointer;
        position: relative; {nodeStyle(layer)}
        background-color: transparent;
        font-family: inherit; font-size: 13px; color: #e2e8f0;
        transition: opacity 0.15s;
      "
    >
      <span style="font-size: 15px;">{layer.icon}</span>
      <span>{$t(layer.name)}</span>
      {#if layer.failCount > 0}
        <span style="
          position: absolute; top: -6px; right: -6px;
          background: {badgeColor(layer)};
          color: white; font-size: 10px; font-weight: bold;
          width: 16px; height: 16px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          line-height: 1;
        ">{layer.failCount}</span>
      {/if}
    </button>
    {#if i < layers.length - 1}
      <span style="color: #4b5563; font-size: 16px;">→</span>
    {/if}
  {/each}
</div>
