<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Chart, LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Legend, Filler } from "chart.js";
  import "chart.js/auto";
  import type { PingResult } from "../lib/types.ts";

  interface Props {
    data: PingResult[];
    title?: string;
  }

  const { data, title = "Latency (ms)" }: Props = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  const COLORS = [
    "#60a5fa", "#34d399", "#f97316", "#a78bfa", "#fb7185", "#fbbf24"
  ];

  function buildDatasets(rows: PingResult[]) {
    // Group by target
    const byTarget = new Map<string, { label: string; points: { x: number; y: number | null }[] }>();
    for (const row of rows) {
      if (!byTarget.has(row.target)) {
        byTarget.set(row.target, { label: row.targetLabel, points: [] });
      }
      byTarget.get(row.target)!.points.push({
        x: row.timestamp,
        y: row.status === "ok" ? row.rttMs : null,
      });
    }

    return Array.from(byTarget.values()).map(({ label, points }, i) => ({
      label,
      data: points.sort((a, b) => a.x - b.x),
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: "transparent",
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.3,
      spanGaps: false,
    }));
  }

  onMount(() => {
    chart = new Chart(canvas, {
      type: "line",
      data: { datasets: buildDatasets(data) },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: {
            type: "linear",
            ticks: {
              color: "#6b7280",
              maxRotation: 0,
              callback: (v) => {
                const d = new Date(v as number);
                return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
              },
            },
            grid: { color: "#1e2030" },
          },
          y: {
            beginAtZero: true,
            ticks: { color: "#6b7280" },
            grid: { color: "#252840" },
            title: { display: true, text: "ms", color: "#6b7280" },
          },
        },
        plugins: {
          legend: {
            labels: { color: "#9ca3af", boxWidth: 12, font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                ctx.parsed.y !== null ? `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}ms` : `${ctx.dataset.label}: timeout`,
            },
          },
        },
      },
    });
  });

  $effect(() => {
    if (chart) {
      chart.data.datasets = buildDatasets(data);
      chart.update("none");
    }
  });

  onDestroy(() => chart?.destroy());
</script>

<div class="chart-wrap">
  <div class="chart-title">{title}</div>
  <div class="chart-container">
    <canvas bind:this={canvas}></canvas>
  </div>
</div>

<style>
  .chart-wrap {
    background: #1e2030;
    border: 1px solid #2a2d3e;
    border-radius: 8px;
    padding: 16px;
  }

  .chart-title {
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 12px;
  }

  .chart-container {
    height: 200px;
    position: relative;
  }
</style>
