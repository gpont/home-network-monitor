<script lang="ts">
  import type { PublicIpEvent, MiscCheck, SslCheck, NetworkStat } from "../lib/types.ts";

  interface Props {
    publicIp: PublicIpEvent | null;
    cgnat: MiscCheck | null;
    mtu: MiscCheck | null;
    ipv6: MiscCheck | null;
    dhcp: MiscCheck | null;
    ssl: SslCheck[];
    networkStats: NetworkStat[];
  }

  const { publicIp, cgnat, mtu, ipv6, dhcp, ssl, networkStats }: Props = $props();

  function parseMiscValue(check: MiscCheck | null): Record<string, unknown> {
    if (!check?.value) return {};
    try { return JSON.parse(check.value); } catch { return {}; }
  }

  function sslStatusColor(status: string): string {
    return { ok: "#22c55e", warning: "#eab308", expired: "#ef4444", error: "#ef4444" }[status] ?? "#6b7280";
  }

  function formatBytes(b: number): string {
    if (b > 1e9) return `${(b / 1e9).toFixed(1)} GB`;
    if (b > 1e6) return `${(b / 1e6).toFixed(1)} MB`;
    return `${(b / 1e3).toFixed(1)} KB`;
  }

  // Deduplicate SSL: latest per host
  const latestSsl = $derived(() => {
    const map = new Map<string, SslCheck>();
    for (const s of ssl) {
      if (!map.has(s.host) || map.get(s.host)!.timestamp < s.timestamp) {
        map.set(s.host, s);
      }
    }
    return Array.from(map.values());
  });

  // Deduplicate network stats: latest per interface
  const latestStats = $derived(() => {
    const map = new Map<string, NetworkStat>();
    for (const s of networkStats) {
      if (!map.has(s.interface) || map.get(s.interface)!.timestamp < s.timestamp) {
        map.set(s.interface, s);
      }
    }
    return Array.from(map.values());
  });

  const mtuValue = $derived(parseMiscValue(mtu));
  const cgnatValue = $derived(parseMiscValue(cgnat));
</script>

<div class="widget">
  <div class="widget-title">Network Health</div>

  <div class="grid">
    <!-- Public IP -->
    <div class="row">
      <span class="key">Public IPv4</span>
      <span class="val">
        {publicIp?.ipv4 ?? "—"}
        {#if publicIp?.changed}
          <span class="badge changed">changed</span>
        {/if}
      </span>
    </div>
    <div class="row">
      <span class="key">Public IPv6</span>
      <span class="val">{publicIp?.ipv6 ?? "—"}</span>
    </div>

    <!-- IPv6 connectivity -->
    <div class="row">
      <span class="key">IPv6 Ping</span>
      <span class="val" class:ok={ipv6?.status === "ok"} class:err={ipv6?.status !== "ok"}>
        {ipv6?.status ?? "—"}
      </span>
    </div>

    <!-- CGNAT -->
    <div class="row">
      <span class="key">NAT type</span>
      <span class="val">
        {cgnat?.status ?? "—"}
        {#if cgnatValue.ispHop}
          <span class="sub">({cgnatValue.ispHop as string})</span>
        {/if}
      </span>
    </div>

    <!-- MTU -->
    <div class="row">
      <span class="key">MTU</span>
      <span class="val" class:warn={mtu?.status === "fragmentation_detected"}>
        {mtu?.status === "ok"
          ? "1500 (ok)"
          : mtu?.status === "fragmentation_detected"
          ? `${mtuValue.maxMtu ?? "?"} (fragmentation!)`
          : (mtu?.status ?? "—")}
      </span>
    </div>

    <!-- DHCP/PPPoE -->
    <div class="row">
      <span class="key">Connection</span>
      <span class="val">{dhcp?.status ?? "—"}</span>
    </div>
  </div>

  <!-- SSL certs -->
  {#if latestSsl().length > 0}
    <div class="section-title">SSL Certificates</div>
    <div class="ssl-list">
      {#each latestSsl() as cert}
        <div class="ssl-row">
          <span class="ssl-host">{cert.host}</span>
          <span class="ssl-days" style="color: {sslStatusColor(cert.status)}">
            {cert.daysRemaining != null ? `${cert.daysRemaining}d` : cert.status}
          </span>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Network interface stats -->
  {#if latestStats().length > 0}
    <div class="section-title">Interface Stats</div>
    <div class="iface-list">
      {#each latestStats() as stat}
        <div class="iface-row">
          <span class="iface-name">{stat.interface}</span>
          <span class="iface-stat">↓{formatBytes(stat.rxBytes)}</span>
          <span class="iface-stat">↑{formatBytes(stat.txBytes)}</span>
          {#if stat.rxErrors + stat.txErrors + stat.rxDropped + stat.txDropped > 0}
            <span class="iface-err">
              err:{stat.rxErrors + stat.txErrors} drop:{stat.rxDropped + stat.txDropped}
            </span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .widget {
    background: #1e2030;
    border: 1px solid #2a2d3e;
    border-radius: 8px;
    padding: 16px;
  }

  .widget-title, .section-title {
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 10px;
  }

  .section-title { margin-top: 16px; }

  .grid { display: flex; flex-direction: column; gap: 4px; }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    padding: 3px 0;
    border-bottom: 1px solid #1a1c2e;
  }

  .key { color: #6b7280; }
  .val { color: #d1d5db; font-variant-numeric: tabular-nums; }
  .val.ok { color: #22c55e; }
  .val.err { color: #ef4444; }
  .val.warn { color: #eab308; }

  .sub { color: #4b5563; font-size: 11px; margin-left: 4px; }

  .badge.changed {
    background: #dc2626;
    color: white;
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 9999px;
    margin-left: 4px;
  }

  .ssl-list, .iface-list { display: flex; flex-direction: column; gap: 4px; }

  .ssl-row {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    padding: 2px 0;
  }

  .ssl-host { color: #d1d5db; }
  .ssl-days { font-weight: 600; font-variant-numeric: tabular-nums; }

  .iface-row {
    display: flex;
    gap: 12px;
    font-size: 12px;
    font-family: monospace;
    color: #9ca3af;
    align-items: center;
  }

  .iface-name { color: #f1f5f9; font-weight: 600; min-width: 60px; }
  .iface-err { color: #ef4444; margin-left: auto; }
</style>
