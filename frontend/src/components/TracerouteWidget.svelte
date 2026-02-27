<script lang="ts">
  import type { TracerouteResult } from "../lib/types.ts";

  interface Props {
    latest: TracerouteResult | null;
  }

  const { latest }: Props = $props();

  function formatTs(ts: number): string {
    return new Date(ts).toLocaleTimeString();
  }
</script>

<div class="widget">
  <div class="widget-title">
    Traceroute to 8.8.8.8
    {#if latest?.routingChanged}
      <span class="badge changed">Route Changed!</span>
    {/if}
  </div>
  {#if latest}
    <div class="meta">Last checked: {formatTs(latest.timestamp)}</div>
    <div class="hops">
      {#each latest.hops as hop}
        <div class="hop" class:no-response={hop.ip === null}>
          <span class="hop-num">{hop.hop}</span>
          <span class="hop-ip">{hop.ip ?? "* * *"}</span>
          <span class="hop-rtt">
            {#if hop.rttMs !== null}
              {hop.rttMs.toFixed(1)}ms
            {/if}
          </span>
        </div>
      {/each}
    </div>
  {:else}
    <div class="no-data">No traceroute data yet</div>
  {/if}
</div>

<style>
  .widget {
    background: #1e2030;
    border: 1px solid #2a2d3e;
    border-radius: 8px;
    padding: 16px;
  }

  .widget-title {
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .badge.changed {
    background: #dc2626;
    color: white;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 9999px;
    text-transform: none;
    font-weight: 700;
  }

  .meta { font-size: 11px; color: #4b5563; margin-bottom: 10px; }

  .hops { display: flex; flex-direction: column; gap: 2px; font-family: monospace; }

  .hop {
    display: grid;
    grid-template-columns: 28px 1fr 70px;
    gap: 8px;
    font-size: 12px;
    padding: 2px 4px;
    border-radius: 4px;
  }

  .hop:hover { background: #252840; }

  .no-response { opacity: 0.4; }

  .hop-num { color: #4b5563; text-align: right; }
  .hop-ip { color: #d1d5db; }
  .hop-rtt { color: #9ca3af; text-align: right; font-variant-numeric: tabular-nums; }

  .no-data { color: #4b5563; font-size: 13px; }
</style>
