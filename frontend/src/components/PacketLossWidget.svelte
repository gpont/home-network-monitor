<script lang="ts">
  interface StatWindow {
    lossPercent: number;
    avgRtt: number | null;
    p95Rtt: number | null;
    jitter: number;
    samples: number;
  }

  interface Props {
    stats: Record<string, Record<string, StatWindow>> | null;
  }

  const { stats }: Props = $props();

  const WINDOWS = ["5m", "15m", "60m"];

  function lossColor(pct: number): string {
    if (pct === 0) return "#22c55e";
    if (pct < 5) return "#eab308";
    return "#ef4444";
  }

  function getTargets(): string[] {
    if (!stats) return [];
    const all = new Set<string>();
    for (const w of WINDOWS) {
      for (const t of Object.keys(stats[w] ?? {})) all.add(t);
    }
    return Array.from(all);
  }
</script>

<div class="widget">
  <div class="widget-title">Packet Loss & Latency</div>
  {#if stats}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Target</th>
            {#each WINDOWS as w}<th>{w}</th>{/each}
            <th>Avg RTT</th>
            <th>Jitter</th>
          </tr>
        </thead>
        <tbody>
          {#each getTargets() as target}
            {@const w60 = stats["60m"]?.[target]}
            <tr>
              <td class="target">{target}</td>
              {#each WINDOWS as w}
                {@const s = stats[w]?.[target]}
                <td>
                  {#if s}
                    <span class="loss" style="color: {lossColor(s.lossPercent)}">
                      {s.lossPercent.toFixed(0)}%
                    </span>
                  {:else}
                    <span class="na">—</span>
                  {/if}
                </td>
              {/each}
              <td class="rtt">{w60?.avgRtt != null ? `${w60.avgRtt.toFixed(1)}ms` : "—"}</td>
              <td class="rtt">{w60?.jitter != null ? `±${w60.jitter.toFixed(1)}ms` : "—"}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="loading">Loading...</div>
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
    margin-bottom: 12px;
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  th {
    text-align: left;
    color: #6b7280;
    font-size: 11px;
    padding: 4px 8px;
    border-bottom: 1px solid #2a2d3e;
  }

  td {
    padding: 6px 8px;
    color: #d1d5db;
    border-bottom: 1px solid #1a1c2e;
  }

  .target { color: #f1f5f9; font-weight: 500; }
  .loss { font-weight: 600; font-variant-numeric: tabular-nums; }
  .rtt { color: #9ca3af; font-variant-numeric: tabular-nums; }
  .na { color: #4b5563; }
  .loading { color: #6b7280; padding: 20px 0; text-align: center; }
</style>
