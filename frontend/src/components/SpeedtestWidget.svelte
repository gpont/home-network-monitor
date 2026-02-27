<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Chart } from "chart.js";
  import "chart.js/auto";
  import type { SpeedtestResult } from "../lib/types.ts";

  interface Props {
    latest: SpeedtestResult | null;
    history: SpeedtestResult[];
  }

  const { latest, history }: Props = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  function formatTs(ts: number): string {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:00`;
  }

  onMount(() => {
    chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: history.map((h) => formatTs(h.timestamp)).reverse(),
        datasets: [
          {
            label: "Download (Mbps)",
            data: history.map((h) => h.downloadMbps).reverse(),
            borderColor: "#60a5fa",
            backgroundColor: "rgba(96,165,250,0.1)",
            fill: true,
            tension: 0.3,
            pointRadius: 3,
          },
          {
            label: "Upload (Mbps)",
            data: history.map((h) => h.uploadMbps).reverse(),
            borderColor: "#34d399",
            backgroundColor: "rgba(52,211,153,0.1)",
            fill: true,
            tension: 0.3,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: { ticks: { color: "#6b7280", maxRotation: 45, font: { size: 10 } }, grid: { color: "#1e2030" } },
          y: { beginAtZero: true, ticks: { color: "#6b7280" }, grid: { color: "#252840" } },
        },
        plugins: {
          legend: { labels: { color: "#9ca3af", boxWidth: 12, font: { size: 11 } } },
        },
      },
    });
  });

  $effect(() => {
    if (chart) {
      chart.data.labels = history.map((h) => formatTs(h.timestamp)).reverse();
      chart.data.datasets[0]!.data = history.map((h) => h.downloadMbps).reverse();
      chart.data.datasets[1]!.data = history.map((h) => h.uploadMbps).reverse();
      chart.update("none");
    }
  });

  onDestroy(() => chart?.destroy());
</script>

<div class="widget">
  <div class="widget-title">Speed Test</div>
  {#if latest}
    <div class="latest">
      <div class="speed">
        <span class="arrow">↓</span>
        <span class="num">{latest.downloadMbps.toFixed(1)}</span>
        <span class="unit">Mbps</span>
      </div>
      <div class="speed">
        <span class="arrow up">↑</span>
        <span class="num">{latest.uploadMbps.toFixed(1)}</span>
        <span class="unit">Mbps</span>
      </div>
      <div class="speed ping">
        <span class="arrow">⏱</span>
        <span class="num">{latest.pingMs.toFixed(0)}</span>
        <span class="unit">ms</span>
      </div>
    </div>
    {#if latest.server}
      <div class="server">{latest.server}</div>
    {/if}
  {:else}
    <div class="no-data">No speedtest data yet</div>
  {/if}
  <div class="chart-container">
    <canvas bind:this={canvas}></canvas>
  </div>
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
    margin-bottom: 12px;
  }

  .latest {
    display: flex;
    gap: 24px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  .speed {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .arrow { font-size: 16px; color: #60a5fa; }
  .arrow.up { color: #34d399; }
  .ping .arrow { color: #a78bfa; }

  .num {
    font-size: 28px;
    font-weight: 700;
    color: #f1f5f9;
    font-variant-numeric: tabular-nums;
  }

  .unit { font-size: 13px; color: #6b7280; }

  .server {
    font-size: 11px;
    color: #4b5563;
    margin-bottom: 12px;
  }

  .chart-container {
    height: 160px;
    position: relative;
    margin-top: 12px;
  }

  .no-data { color: #4b5563; font-size: 13px; padding: 8px 0; }
</style>
