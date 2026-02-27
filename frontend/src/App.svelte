<script lang="ts">
  import { onMount } from "svelte";
  import { wsConnected, onWsEvent } from "./lib/ws.ts";
  import { api } from "./lib/api.ts";
  import type {
    StatusResponse,
    PingResult,
    SpeedtestResult,
    Event,
  } from "./lib/types.ts";

  import StatusCard from "./components/StatusCard.svelte";
  import LatencyChart from "./components/LatencyChart.svelte";
  import PacketLossWidget from "./components/PacketLossWidget.svelte";
  import SpeedtestWidget from "./components/SpeedtestWidget.svelte";
  import TracerouteWidget from "./components/TracerouteWidget.svelte";
  import NetworkHealthWidget from "./components/NetworkHealthWidget.svelte";
  import EventsLog from "./components/EventsLog.svelte";

  let status = $state<StatusResponse | null>(null);
  let pingHistory = $state<PingResult[]>([]);
  let pingStats = $state<Record<string, Record<string, { lossPercent: number; avgRtt: number | null; p95Rtt: number | null; jitter: number; samples: number }>> | null>(null);
  let speedtestHistory = $state<SpeedtestResult[]>([]);
  let events = $state<Event[]>([]);
  let lastUpdated = $state<number | null>(null);

  // Ping target status helper
  function pingStatus(target: string): { status: "ok" | "error" | "timeout" | "warning" | "unknown"; rtt: string | null; ts: number | null } {
    const r = status?.ping.find((p) => p.target === target || p.targetLabel === target);
    if (!r) return { status: "unknown", rtt: null, ts: null };
    return {
      status: r.status === "ok" ? "ok" : r.status === "timeout" ? "timeout" : "error",
      rtt: r.rttMs != null ? `${r.rttMs.toFixed(1)}ms` : null,
      ts: r.timestamp,
    };
  }

  function dnsStatus(serverLabel: string) {
    const r = status?.dns.find((d) => d.serverLabel === serverLabel);
    if (!r) return { status: "unknown" as const, rtt: null, ts: null };
    return {
      status: r.status === "ok" ? "ok" as const : "error" as const,
      rtt: r.latencyMs != null ? `${r.latencyMs.toFixed(0)}ms` : null,
      ts: r.timestamp,
    };
  }

  function httpStatus(urlPart: string) {
    const r = status?.http.find((h) => h.url.includes(urlPart));
    if (!r) return { status: "unknown" as const, rtt: null, ts: null };
    const ok = r.statusCode !== null && r.statusCode < 400;
    return {
      status: (ok ? "ok" : "error") as "ok" | "error",
      rtt: r.latencyMs != null ? `${r.latencyMs.toFixed(0)}ms` : r.error ?? null,
      ts: r.timestamp,
    };
  }

  async function loadAll() {
    const [s, ph, ps, sth, ev] = await Promise.allSettled([
      api.status(),
      api.pingHistory(60),
      api.pingStats(),
      api.speedtest(48),
      api.events(),
    ]);

    if (s.status === "fulfilled") status = s.value;
    if (ph.status === "fulfilled") pingHistory = ph.value;
    if (ps.status === "fulfilled") pingStats = ps.value;
    if (sth.status === "fulfilled") speedtestHistory = sth.value;
    if (ev.status === "fulfilled") events = ev.value;
    lastUpdated = Date.now();
  }

  onMount(() => {
    loadAll();

    // Refresh status every 10s
    const interval = setInterval(() => loadAll(), 10_000);

    // Update on WS push
    const unsub = onWsEvent("*", () => {
      loadAll();
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  });

  function timeAgo(ts: number | null): string {
    if (!ts) return "";
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return "just now";
    return `${diff}s ago`;
  }
</script>

<div class="app">
  <header>
    <div class="title">
      <span class="icon">📡</span>
      Network Monitor
    </div>
    <div class="header-right">
      {#if lastUpdated}
        <span class="updated">Updated {timeAgo(lastUpdated)}</span>
      {/if}
      <div class="ws-badge" class:connected={$wsConnected}>
        {$wsConnected ? "Live" : "Reconnecting..."}
      </div>
    </div>
  </header>

  <main>
    <!-- ─── Status Overview ─────────────────────────────────────── -->
    <section>
      <h2>Connectivity</h2>
      <div class="cards">
        {#each status?.ping ?? [] as p}
          <StatusCard
            label={p.targetLabel}
            status={p.status === "ok" ? "ok" : p.status === "timeout" ? "timeout" : "error"}
            value={p.rttMs != null ? `${p.rttMs.toFixed(1)}ms` : null}
            updatedAt={p.timestamp}
          />
        {/each}
      </div>
    </section>

    <section>
      <h2>DNS</h2>
      <div class="cards">
        {#each status?.dns ?? [] as d}
          <StatusCard
            label={d.serverLabel}
            status={d.status === "ok" ? "ok" : "error"}
            value={d.latencyMs != null ? `${d.latencyMs.toFixed(0)}ms` : d.status}
            sub={d.domain}
            updatedAt={d.timestamp}
          />
        {/each}
      </div>
    </section>

    <section>
      <h2>HTTP</h2>
      <div class="cards">
        {#each status?.http ?? [] as h}
          {@const ok = h.statusCode !== null && h.statusCode < 400}
          <StatusCard
            label={h.url.replace("https://www.", "").replace("https://", "")}
            status={ok ? "ok" : "error"}
            value={h.latencyMs != null ? `${h.latencyMs.toFixed(0)}ms` : (h.error ?? "error")}
            sub={h.statusCode != null ? `HTTP ${h.statusCode}` : null}
            updatedAt={h.timestamp}
          />
        {/each}
      </div>
    </section>

    <!-- ─── Charts ──────────────────────────────────────────────── -->
    <section>
      <h2>Connection Quality</h2>
      <div class="charts-grid">
        <LatencyChart data={pingHistory} title="Latency (last 60 min)" />
        <PacketLossWidget stats={pingStats} />
      </div>
    </section>

    <!-- ─── Traceroute + Speed ──────────────────────────────────── -->
    <section>
      <div class="two-col">
        <TracerouteWidget latest={status?.traceroute ?? null} />
        <SpeedtestWidget latest={status?.speedtest ?? null} history={speedtestHistory} />
      </div>
    </section>

    <!-- ─── Network Health + Events ────────────────────────────── -->
    <section>
      <div class="two-col">
        <NetworkHealthWidget
          publicIp={status?.publicIp ?? null}
          cgnat={status?.cgnat ?? null}
          mtu={status?.mtu ?? null}
          ipv6={status?.ipv6 ?? null}
          dhcp={status?.dhcp ?? null}
          ssl={status?.ssl ?? []}
          networkStats={status?.networkStats ?? []}
        />
        <EventsLog {events} />
      </div>
    </section>
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
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .icon { font-size: 20px; }

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

  main {
    flex: 1;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 1400px;
    width: 100%;
    margin: 0 auto;
  }

  section h2 {
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 12px;
  }

  .cards {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 16px;
  }

  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  @media (max-width: 900px) {
    .charts-grid, .two-col {
      grid-template-columns: 1fr;
    }

    main { padding: 16px; }
  }
</style>
