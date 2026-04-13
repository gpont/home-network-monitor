import type { StatusResponse, CheckDefinition, LayerDefinition } from "./types.ts";

export const LAYERS: LayerDefinition[] = [
  { id: 1, name: 'layer.1.name', icon: '🖥' },
  { id: 2, name: 'layer.2.name', icon: '📡' },
  { id: 3, name: 'layer.3.name', icon: '🌐' },
  { id: 4, name: 'layer.4.name', icon: '🌍' },
  { id: 5, name: 'layer.5.name', icon: '🔍' },
  { id: 6, name: 'layer.6.name', icon: '🌏' },
  { id: 7, name: 'layer.7.name', icon: '🔐' },
];

const STALE = {
  s30: 90_000,      // 30s interval → stale after 90s
  s60: 180_000,     // 60s interval → stale after 180s
  m5:  900_000,     // 5min → stale after 15min
  m10: 1_800_000,   // 10min → stale after 30min
  m15: 2_700_000,   // 15min → stale after 45min
  h1:  7_200_000,   // 1h → stale after 2h
  h24: 172_800_000, // 24h → stale after 48h
};

function isStale(timestamp: number | undefined, staleMs: number): boolean {
  if (!timestamp) return true;
  return Date.now() - timestamp > staleMs;
}

function pingFor(s: StatusResponse, target: string) {
  return s.ping.find(p => p.target === target || p.target.startsWith(target));
}

/** Returns true if mtu value is acceptable given the connection type.
 *  PPPoE standard is 1492 (not 1500), so 1492 is ok for PPPoE connections. */
function mtuIsOk(s: StatusResponse): boolean {
  if (!s.mtu || s.mtu.status === "error") return false;
  if (s.mtu.status === "ok") return true;
  try {
    const maxMtu: number = JSON.parse(s.mtu.value ?? "{}").maxMtu ?? 0;
    // 1492 is the minimum acceptable MTU for home networks — covers both direct PPPoE
    // and DHCP behind a PPPoE router where the router's overhead propagates the MTU restriction.
    return maxMtu >= 1492;
  } catch { return false; }
}

function gwPing(s: StatusResponse) {
  // Gateway is the ping target with lowest RTT that is not 8.8.8.8/1.1.1.1/9.9.9.9
  return s.ping.find(p => !["8.8.8.8","1.1.1.1","9.9.9.9"].includes(p.target) && p.targetLabel?.toLowerCase().includes("router"));
}

export const CHECKS: CheckDefinition[] = [
  // ── Layer 1: Device / Interface ──────────────────────────
  {
    id: "iface_up", layer: 1, name: "check.iface_up.name", description: "Сетевой интерфейс в состоянии UP",
    hint: "check.iface_up.hint",
    noDataHint: "check.iface_up.noData",
    staleAfterMs: STALE.s30,
    getValue: s => s.interface?.interfaceName ?? null,
    getStatus: s => {
      if (!s.interface) return "unknown";
      if (isStale(s.interface.timestamp, STALE.s30)) return "stale";
      return s.interface.status === "up" ? "ok" : s.interface.status === "unknown" ? "unknown" : "fail";
    },
    getFix: s => s.interface?.status === "down" ? ["check.iface_up.fix.0", "check.iface_up.fix.1", "check.iface_up.fix.2"] : null,
  },
  {
    id: "iface_ipv4", layer: 1, name: "check.iface_ipv4.name", description: "IPv4 адрес назначен интерфейсу",
    hint: "check.iface_ipv4.hint",
    noDataHint: "check.iface_ipv4.noData",
    staleAfterMs: STALE.s30,
    getValue: s => s.interface?.ipv4 ?? null,
    getStatus: s => {
      if (!s.interface) return "unknown";
      if (isStale(s.interface.timestamp, STALE.s30)) return "stale";
      return s.interface.ipv4 ? "ok" : "fail";
    },
    getFix: s => !s.interface?.ipv4 ? ["check.iface_ipv4.fix.0", "check.iface_ipv4.fix.1", "check.iface_ipv4.fix.2"] : null,
  },
  {
    id: "iface_gateway", layer: 1, name: "check.iface_gateway.name", description: "Шлюз по умолчанию задан",
    hint: "check.iface_gateway.hint",
    noDataHint: "check.iface_gateway.noData",
    staleAfterMs: STALE.s30,
    getValue: s => s.interface?.gatewayIp ?? null,
    getStatus: s => {
      if (!s.interface) return "unknown";
      if (isStale(s.interface.timestamp, STALE.s30)) return "stale";
      return s.interface.gatewayIp ? "ok" : "fail";
    },
    getFix: s => !s.interface?.gatewayIp ? ["check.iface_gateway.fix.0", "check.iface_gateway.fix.1"] : null,
  },
  {
    id: "iface_dhcp", layer: 1, name: "check.iface_dhcp.name", description: "Тип подключения определён (DHCP/PPPoE)",
    hint: "check.iface_dhcp.hint",
    noDataHint: "check.iface_dhcp.noData",
    staleAfterMs: STALE.m5,
    getValue: s => s.interface?.connectionType ?? null,
    getStatus: s => {
      if (!s.interface) return "unknown";
      if (isStale(s.interface.timestamp, STALE.m5)) return "stale";
      return s.interface.connectionType !== "unknown" ? "ok" : "unknown";
    },
    getFix: s => s.interface?.connectionType === "unknown" ? ["check.iface_dhcp.fix.0", "check.iface_dhcp.fix.1"] : null,
  },
  {
    id: "iface_errors", layer: 1, name: "check.iface_errors.name", description: "rx_errors + tx_errors = 0",
    hint: "check.iface_errors.hint",
    noDataHint: "check.iface_errors.noData",
    staleAfterMs: STALE.s30,
    getValue: s => s.interface ? String(s.interface.rxErrors + s.interface.txErrors) : null,
    getStatus: s => {
      if (!s.interface) return "unknown";
      if (isStale(s.interface.timestamp, STALE.s30)) return "stale";
      return (s.interface.rxErrors + s.interface.txErrors) === 0 ? "ok" : "warn";
    },
    getFix: s => (s.interface && (s.interface.rxErrors + s.interface.txErrors) > 0) ? ["check.iface_errors.fix.0", "check.iface_errors.fix.1"] : null,
  },
  {
    id: "iface_drops", layer: 1, name: "check.iface_drops.name", description: "rx_dropped + tx_dropped = 0",
    hint: "check.iface_drops.hint",
    noDataHint: "check.iface_drops.noData",
    staleAfterMs: STALE.s30,
    getValue: s => s.interface ? String(s.interface.rxDropped + s.interface.txDropped) : null,
    getStatus: s => {
      if (!s.interface) return "unknown";
      if (isStale(s.interface.timestamp, STALE.s30)) return "stale";
      return (s.interface.rxDropped + s.interface.txDropped) === 0 ? "ok" : "warn";
    },
    getFix: s => (s.interface && (s.interface.rxDropped + s.interface.txDropped) > 0) ? ["check.iface_drops.fix.0", "check.iface_drops.fix.1"] : null,
  },
  {
    id: "iface_ipv6_ll", layer: 1, name: "check.iface_ipv6_ll.name", description: "IPv6 link-local адрес (fe80::) назначен",
    hint: "check.iface_ipv6_ll.hint",
    noDataHint: "check.iface_ipv6_ll.noData",
    staleAfterMs: STALE.s30,
    getValue: s => s.interface?.ipv6LinkLocal ?? null,
    getStatus: s => {
      if (!s.interface) return "unknown";
      if (isStale(s.interface.timestamp, STALE.s30)) return "stale";
      if (s.interface.ipv6LinkLocal) return "ok";
      // No IPv6 at all (container/host without IPv6) — not actionable
      if (s.ipv6?.status === "unavailable") return "unknown";
      return "warn";
    },
    getFix: s => (!s.interface?.ipv6LinkLocal && s.ipv6?.status !== "unavailable") ? ["check.iface_ipv6_ll.fix.0", "check.iface_ipv6_ll.fix.1"] : null,
  },
  {
    id: "iface_arp", layer: 1, name: "check.iface_arp.name", description: "MAC-адрес шлюза есть в ARP таблице",
    hint: "check.iface_arp.hint",
    noDataHint: "check.iface_arp.noData",
    staleAfterMs: STALE.m5,
    getValue: s => s.interface?.gatewayMac ?? null,
    getStatus: s => {
      if (!s.interface) return "unknown";
      if (isStale(s.interface.timestamp, STALE.m5)) return "stale";
      return s.interface.gatewayMac ? "ok" : "warn";
    },
    getFix: s => !s.interface?.gatewayMac ? ["check.iface_arp.fix.0", "check.iface_arp.fix.1"] : null,
  },

  // ── Layer 2: Gateway / Local ──────────────────────────────
  {
    id: "gw_ping", layer: 2, name: "check.gw_ping.name", description: "ICMP ping до роутера — RTT < 5ms",
    hint: "check.gw_ping.hint",
    noDataHint: "check.gw_ping.noData",
    configHint: ["check.gw_ping.config.0", "check.gw_ping.config.1"],
    staleAfterMs: STALE.s30,
    getValue: s => {
      const gw = gwPing(s);
      return gw?.rttMs != null ? `${gw.rttMs.toFixed(1)}ms` : null;
    },
    getStatus: s => {
      const gw = gwPing(s);
      if (!gw) return "unknown";
      if (isStale(gw.timestamp, STALE.s30)) return "stale";
      if (gw.status === "timeout") return "fail";
      if (gw.status === "error") return "fail";
      return (gw.rttMs ?? 999) < 5 ? "ok" : "warn";
    },
    getFix: s => {
      const gw = gwPing(s);
      return gw?.status !== "ok" ? ["check.gw_ping.fix.0", "check.gw_ping.fix.1", "check.gw_ping.fix.2"] : null;
    },
  },
  {
    id: "gw_ping_loss", layer: 2, name: "check.gw_ping_loss.name", description: "Потери пакетов до роутера < 1% за 15 мин",
    hint: "check.gw_ping_loss.hint",
    noDataHint: "check.gw_ping_loss.noData",
    staleAfterMs: STALE.m15,
    getValue: s => {
      const gwTarget = gwPing(s)?.target;
      const stats = gwTarget ? s.pingStats?.[gwTarget] : null;
      return stats ? `${stats.lossPercent.toFixed(1)}%` : null;
    },
    getStatus: s => {
      const gwTarget = gwPing(s)?.target;
      if (!gwTarget || !s.pingStats) return "unknown";
      const stats = s.pingStats[gwTarget];
      if (!stats) return "unknown";
      return stats.lossPercent < 1 ? "ok" : stats.lossPercent < 5 ? "warn" : "fail";
    },
    getFix: s => {
      const gwTarget = gwPing(s)?.target;
      const stats = gwTarget ? s.pingStats?.[gwTarget] : null;
      return stats && stats.lossPercent >= 1 ? ["check.gw_ping_loss.fix.0", "check.gw_ping_loss.fix.1", "check.gw_ping_loss.fix.2"] : null;
    },
  },
  {
    id: "gw_dns", layer: 2, name: "check.gw_dns.name", description: "DNS сервер роутера отвечает < 100ms",
    hint: "check.gw_dns.hint",
    noDataHint: "check.gw_dns.noData",
    configHint: ["check.gw_dns.config.0", "check.gw_dns.config.1"],
    staleAfterMs: STALE.s60,
    getValue: s => {
      const gw = s.dns.find(d => !["8.8.8.8","1.1.1.1"].includes(d.server));
      return gw?.latencyMs != null ? `${Math.round(gw.latencyMs)}ms` : null;
    },
    getStatus: s => {
      const gw = s.dns.find(d => !["8.8.8.8","1.1.1.1"].includes(d.server));
      if (!gw) return "unknown";
      if (isStale(gw.timestamp, STALE.s60)) return "stale";
      if (gw.status !== "ok") return "fail";
      return (gw.latencyMs ?? 999) < 100 ? "ok" : "warn";
    },
    getFix: s => {
      const gw = s.dns.find(d => !["8.8.8.8","1.1.1.1"].includes(d.server));
      return gw?.status !== "ok" ? ["check.gw_dns.fix.0", "check.gw_dns.fix.1", "check.gw_dns.fix.2"] : null;
    },
  },
  {
    id: "gw_mtu", layer: 2, name: "check.gw_mtu.name", description: "Нет фрагментации пакетов 1500 байт",
    hint: "check.gw_mtu.hint",
    noDataHint: "nodata.mtu_pending",
    runnable: true, runType: "mtu",
    staleAfterMs: STALE.m15,
    getValue: s => {
      const mtu = s.mtu;
      if (!mtu) return null;
      try { const v = JSON.parse(mtu.value ?? "{}"); return v.maxMtu ? `${v.maxMtu}` : null; } catch { return null; }
    },
    getStatus: s => {
      if (!s.mtu) return "unknown";
      if (isStale(s.mtu.timestamp, STALE.m15)) return "stale";
      if (s.mtu.status === "error") return "fail";
      return mtuIsOk(s) ? "ok" : "warn";
    },
    getFix: s => (!s.mtu || mtuIsOk(s)) ? null : ["check.gw_mtu.fix.0", "check.gw_mtu.fix.1", "check.gw_mtu.fix.2", "check.gw_mtu.fix.3"],
  },
  {
    id: "gw_jitter", layer: 2, name: "check.gw_jitter.name", description: "Нестабильность RTT до роутера < 5ms",
    hint: "check.gw_jitter.hint",
    noDataHint: "check.gw_jitter.noData",
    staleAfterMs: STALE.m15,
    getValue: s => {
      const gwTarget = gwPing(s)?.target;
      const stats = gwTarget ? s.pingStats?.[gwTarget] : null;
      return stats?.jitterMs != null ? `${stats.jitterMs.toFixed(1)}ms` : null;
    },
    getStatus: s => {
      const gwTarget = gwPing(s)?.target;
      if (!gwTarget || !s.pingStats) return "unknown";
      const stats = s.pingStats[gwTarget];
      if (!stats || stats.jitterMs == null) return "unknown";
      return stats.jitterMs < 5 ? "ok" : stats.jitterMs < 15 ? "warn" : "fail";
    },
    getFix: s => {
      const gwTarget = gwPing(s)?.target;
      const stats = gwTarget ? s.pingStats?.[gwTarget] : null;
      return stats?.jitterMs != null && stats.jitterMs >= 5 ? ["check.gw_jitter.fix.0", "check.gw_jitter.fix.1", "check.gw_jitter.fix.2"] : null;
    },
  },
  {
    id: "iface_speed", layer: 2, name: "check.iface_speed.name", description: "Информация об интерфейсе (информационный чек)",
    hint: "check.iface_speed.hint",
    noDataHint: "check.iface_speed.noData",
    staleAfterMs: STALE.s30,
    getValue: s => {
      if (!s.networkStats?.length) return null;
      return s.interface?.interfaceName ?? null;
    },
    getStatus: s => s.networkStats?.length ? "ok" : "unknown",
    getFix: () => null,
  },

  // ── Layer 3: ISP / WAN ────────────────────────────────────
  {
    id: "isp_hop", layer: 3, name: "check.isp_hop.name", description: "Первый хоп провайдера доступен",
    hint: "check.isp_hop.hint",
    noDataHint: "nodata.traceroute_pending_isp",
    runnable: true, runType: "traceroute",
    staleAfterMs: STALE.m10,
    getValue: s => {
      if (!s.traceroute) return null;
      const hops = s.traceroute.hops;
      const isp = hops.find(h => h.ip && !/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(h.ip));
      return isp ? isp.ip : null;
    },
    getStatus: s => {
      if (!s.traceroute) return "unknown";
      if (isStale(s.traceroute.timestamp, STALE.m10)) return "stale";
      const hops = s.traceroute.hops;
      const isp = hops.find(h => h.ip && !/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(h.ip));
      return isp ? "ok" : "unknown";
    },
    getFix: () => null,
  },
  {
    id: "isp_hop_rtt", layer: 3, name: "check.isp_hop_rtt.name", description: "Задержка до первого хопа провайдера < 20ms",
    hint: "check.isp_hop_rtt.hint",
    noDataHint: "nodata.traceroute_isp_hidden",
    runnable: true, runType: "traceroute",
    staleAfterMs: STALE.m10,
    getValue: s => {
      if (!s.traceroute) return null;
      const hops = s.traceroute.hops;
      const isp = hops.find(h => h.ip && !/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(h.ip));
      return isp?.rttMs != null ? `${isp.rttMs.toFixed(1)}ms` : null;
    },
    getStatus: s => {
      if (!s.traceroute) return "unknown";
      if (isStale(s.traceroute.timestamp, STALE.m10)) return "stale";
      const hops = s.traceroute.hops;
      const isp = hops.find(h => h.ip && !/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(h.ip));
      if (!isp || isp.rttMs == null) return "unknown";
      return isp.rttMs < 20 ? "ok" : isp.rttMs < 50 ? "warn" : "fail";
    },
    getFix: s => {
      if (!s.traceroute) return null;
      const hops = s.traceroute.hops;
      const isp = hops.find(h => h.ip && h.rttMs != null && h.rttMs >= 50);
      return isp ? ["check.isp_hop_rtt.fix.0", "check.isp_hop_rtt.fix.1", "check.isp_hop_rtt.fix.2"] : null;
    },
  },
  {
    id: "wan_type", layer: 3, name: "check.wan_type.name", description: "Тип подключения к провайдеру определён",
    hint: "check.wan_type.hint",
    noDataHint: "check.wan_type.noData",
    staleAfterMs: STALE.m5,
    getValue: s => s.interface?.connectionType ?? null,
    getStatus: s => {
      if (!s.interface) return "unknown";
      return s.interface.connectionType !== "unknown" ? "ok" : "unknown";
    },
    getFix: () => null,
  },
  {
    id: "cgnat", layer: 3, name: "check.cgnat.name", description: "Публичный IP — не за CGNAT провайдера",
    hint: "check.cgnat.hint",
    noDataHint: "nodata.cgnat_pending",
    runnable: true, runType: "cgnat",
    staleAfterMs: STALE.h1,
    getValue: s => s.cgnat?.status ?? null,
    getStatus: s => {
      if (!s.cgnat) return "unknown";
      if (isStale(s.cgnat.timestamp, STALE.h1)) return "stale";
      return s.cgnat.status === "direct" ? "ok" : s.cgnat.status === "cgnat" ? "warn" : "unknown";
    },
    getFix: s => s.cgnat?.status === "cgnat" ? ["check.cgnat.fix.0", "check.cgnat.fix.1", "check.cgnat.fix.2"] : null,
  },
  {
    id: "public_ip", layer: 3, name: "check.public_ip.name", description: "Публичный IPv4 адрес получен",
    hint: "check.public_ip.hint",
    noDataHint: "nodata.publicip_pending",
    runnable: true, runType: "publicip",
    staleAfterMs: STALE.m5,
    getValue: s => s.publicIp?.ipv4 ?? null,
    getStatus: s => {
      if (!s.publicIp) return "unknown";
      if (isStale(s.publicIp.timestamp, STALE.m5)) return "stale";
      return s.publicIp.ipv4 ? "ok" : "fail";
    },
    getFix: s => !s.publicIp?.ipv4 ? ["check.public_ip.fix.0", "check.public_ip.fix.1", "check.public_ip.fix.2"] : null,
  },
  {
    id: "route_stable", layer: 3, name: "check.route_stable.name", description: "Маршрут трассировки не изменился",
    hint: "check.route_stable.hint",
    noDataHint: "nodata.traceroute_pending",
    runnable: true, runType: "traceroute",
    staleAfterMs: STALE.m10,
    getValue: s => s.traceroute ? (s.traceroute.routingChanged ? "ui.value.changed" : "ui.value.stable") : null,
    getStatus: s => {
      if (!s.traceroute) return "unknown";
      if (isStale(s.traceroute.timestamp, STALE.m10)) return "stale";
      return s.traceroute.routingChanged ? "warn" : "ok";
    },
    getFix: s => s.traceroute?.routingChanged ? ["check.route_stable.fix.0", "check.route_stable.fix.1", "check.route_stable.fix.2"] : null,
  },
  {
    id: "isp_dns", layer: 3, name: "check.isp_dns.name", description: "Информация о DNS провайдера",
    hint: "check.isp_dns.hint",
    noDataHint: "check.isp_dns.noData",
    staleAfterMs: STALE.s60,
    getValue: s => s.osResolver?.nameservers?.[0] ?? null,
    getStatus: s => {
      if (!s.osResolver) return "unknown";
      return s.osResolver.status === "ok" ? "ok" : "unknown";
    },
    getFix: () => null,
  },

  // ── Layer 4: Internet (L3) ────────────────────────────────
  {
    id: "ping_8888", layer: 4, name: "check.ping_8888.name", description: "ICMP ping до Google DNS — RTT < 50ms",
    hint: "check.ping_8888.hint",
    noDataHint: "nodata.ping_pending",
    staleAfterMs: STALE.s30,
    getValue: s => { const p = pingFor(s, "8.8.8.8"); return p?.rttMs != null ? `${p.rttMs.toFixed(1)}ms` : null; },
    getStatus: s => {
      const p = pingFor(s, "8.8.8.8");
      if (!p) return "unknown";
      if (isStale(p.timestamp, STALE.s30)) return "stale";
      if (p.status !== "ok") return "fail";
      return (p.rttMs ?? 999) < 50 ? "ok" : "warn";
    },
    getFix: s => pingFor(s, "8.8.8.8")?.status !== "ok" ? ["check.ping_8888.fix.0", "check.ping_8888.fix.1", "check.ping_8888.fix.2"] : null,
  },
  {
    id: "ping_1111", layer: 4, name: "check.ping_1111.name", description: "ICMP ping до Cloudflare DNS — RTT < 50ms",
    hint: "check.ping_1111.hint",
    noDataHint: "nodata.ping_pending",
    staleAfterMs: STALE.s30,
    getValue: s => { const p = pingFor(s, "1.1.1.1"); return p?.rttMs != null ? `${p.rttMs.toFixed(1)}ms` : null; },
    getStatus: s => {
      const p = pingFor(s, "1.1.1.1");
      if (!p) return "unknown";
      if (isStale(p.timestamp, STALE.s30)) return "stale";
      if (p.status !== "ok") return "fail";
      return (p.rttMs ?? 999) < 50 ? "ok" : "warn";
    },
    getFix: s => pingFor(s, "1.1.1.1")?.status !== "ok" ? ["check.ping_1111.fix.0", "check.ping_1111.fix.1"] : null,
  },
  {
    id: "ping_9999", layer: 4, name: "check.ping_9999.name", description: "ICMP ping до Quad9 DNS — RTT < 100ms",
    hint: "check.ping_9999.hint",
    noDataHint: "nodata.ping_pending",
    staleAfterMs: STALE.s30,
    getValue: s => { const p = pingFor(s, "9.9.9.9"); return p?.rttMs != null ? `${p.rttMs.toFixed(1)}ms` : null; },
    getStatus: s => {
      const p = pingFor(s, "9.9.9.9");
      if (!p) return "unknown";
      if (isStale(p.timestamp, STALE.s30)) return "stale";
      if (p.status !== "ok") return "fail";
      return (p.rttMs ?? 999) < 100 ? "ok" : "warn";
    },
    getFix: s => pingFor(s, "9.9.9.9")?.status !== "ok" ? ["check.ping_9999.fix.0", "check.ping_9999.fix.1"] : null,
  },
  {
    id: "tcp_443", layer: 4, name: "check.tcp_443.name", description: "TCP соединение к 1.1.1.1:443 успешно",
    hint: "check.tcp_443.hint",
    noDataHint: "nodata.tcp_pending",
    staleAfterMs: STALE.s30,
    getValue: s => s.tcpConnect?.latencyMs != null ? `${Math.round(s.tcpConnect.latencyMs)}ms` : null,
    getStatus: s => {
      if (!s.tcpConnect) return "unknown";
      if (isStale(s.tcpConnect.timestamp, STALE.s30)) return "stale";
      return s.tcpConnect.status === "ok" ? "ok" : "fail";
    },
    getFix: s => s.tcpConnect?.status !== "ok" ? ["check.tcp_443.fix.0", "check.tcp_443.fix.1", "check.tcp_443.fix.2"] : null,
  },
  {
    id: "pkt_loss", layer: 4, name: "check.pkt_loss.name", description: "Потери пакетов < 1% за 15 минут",
    hint: "check.pkt_loss.hint",
    noDataHint: "nodata.pingstat_pending",
    staleAfterMs: STALE.m15,
    getValue: s => {
      if (!s.pingStats) return null;
      const max = Math.max(...Object.values(s.pingStats).map(t => t.lossPercent));
      return `${max.toFixed(1)}%`;
    },
    getStatus: s => {
      if (!s.pingStats) return "unknown";
      const max = Math.max(...Object.values(s.pingStats).map(t => t.lossPercent));
      return max < 1 ? "ok" : max < 5 ? "warn" : "fail";
    },
    getFix: s => {
      if (!s.pingStats) return null;
      const max = Math.max(...Object.values(s.pingStats).map(t => t.lossPercent));
      return max >= 1 ? ["check.pkt_loss.fix.0", "check.pkt_loss.fix.1", "check.pkt_loss.fix.2"] : null;
    },
  },
  {
    id: "jitter", layer: 4, name: "check.jitter.name", description: "Нестабильность RTT до интернета < 10ms",
    hint: "check.jitter.hint",
    noDataHint: "nodata.jitter_pending",
    staleAfterMs: STALE.m15,
    getValue: s => {
      const p8 = s.pingStats?.["8.8.8.8"];
      return p8?.jitterMs != null ? `${p8.jitterMs.toFixed(1)}ms` : null;
    },
    getStatus: s => {
      const p8 = s.pingStats?.["8.8.8.8"];
      if (!p8 || p8.jitterMs == null) return "unknown";
      return p8.jitterMs < 10 ? "ok" : p8.jitterMs < 30 ? "warn" : "fail";
    },
    getFix: s => {
      const p8 = s.pingStats?.["8.8.8.8"];
      return p8?.jitterMs != null && p8.jitterMs >= 10 ? ["check.jitter.fix.0", "check.jitter.fix.1", "check.jitter.fix.2"] : null;
    },
  },
  {
    id: "no_blackhole", layer: 4, name: "check.no_blackhole.name", description: "В traceroute нет 3+ подряд пропущенных хопов",
    hint: "check.no_blackhole.hint",
    noDataHint: "nodata.traceroute_pending",
    runnable: true, runType: "traceroute",
    staleAfterMs: STALE.m10,
    getValue: s => s.traceroute ? ((s.traceroute as any).hasBlackHole ? "ui.value.detected" : "ui.value.none") : null,
    getStatus: s => {
      if (!s.traceroute) return "unknown";
      if (isStale(s.traceroute.timestamp, STALE.m10)) return "stale";
      return (s.traceroute as any).hasBlackHole ? "warn" : "ok";
    },
    getFix: s => (s.traceroute as any)?.hasBlackHole ? ["check.no_blackhole.fix.0", "check.no_blackhole.fix.1", "check.no_blackhole.fix.2"] : null,
  },

  // ── Layer 5: DNS ──────────────────────────────────────────
  {
    id: "dns_gw", layer: 5, name: "check.dns_gw.name", description: "DNS сервер роутера возвращает корректный ответ",
    hint: "check.dns_gw.hint",
    noDataHint: "check.dns_gw.noData",
    configHint: ["check.dns_gw.config.0", "check.dns_gw.config.1"],
    staleAfterMs: STALE.s60,
    getValue: s => {
      const d = s.dns.find(d => !["8.8.8.8","1.1.1.1"].includes(d.server));
      return d?.latencyMs != null ? `${Math.round(d.latencyMs)}ms` : null;
    },
    getStatus: s => {
      const d = s.dns.find(d => !["8.8.8.8","1.1.1.1"].includes(d.server));
      if (!d) return "unknown";
      if (isStale(d.timestamp, STALE.s60)) return "stale";
      return d.status === "ok" ? "ok" : "fail";
    },
    getFix: s => {
      const d = s.dns.find(d => !["8.8.8.8","1.1.1.1"].includes(d.server));
      return d?.status !== "ok" ? ["check.dns_gw.fix.0", "check.dns_gw.fix.1", "check.dns_gw.fix.2"] : null;
    },
  },
  {
    id: "dns_8888", layer: 5, name: "check.dns_8888.name", description: "Google Public DNS отвечает корректно",
    hint: "check.dns_8888.hint",
    noDataHint: "nodata.dns_pending",
    staleAfterMs: STALE.s60,
    getValue: s => { const d = s.dns.find(d => d.server === "8.8.8.8"); return d?.latencyMs != null ? `${Math.round(d.latencyMs)}ms` : null; },
    getStatus: s => {
      const d = s.dns.find(d => d.server === "8.8.8.8");
      if (!d) return "unknown";
      if (isStale(d.timestamp, STALE.s60)) return "stale";
      return d.status === "ok" ? "ok" : "fail";
    },
    getFix: s => s.dns.find(d => d.server === "8.8.8.8")?.status !== "ok" ? ["check.dns_8888.fix.0", "check.dns_8888.fix.1"] : null,
  },
  {
    id: "dns_1111", layer: 5, name: "check.dns_1111.name", description: "Cloudflare DNS отвечает корректно",
    hint: "check.dns_1111.hint",
    noDataHint: "nodata.dns_pending",
    staleAfterMs: STALE.s60,
    getValue: s => { const d = s.dns.find(d => d.server === "1.1.1.1"); return d?.latencyMs != null ? `${Math.round(d.latencyMs)}ms` : null; },
    getStatus: s => {
      const d = s.dns.find(d => d.server === "1.1.1.1");
      if (!d) return "unknown";
      if (isStale(d.timestamp, STALE.s60)) return "stale";
      return d.status === "ok" ? "ok" : "fail";
    },
    getFix: s => s.dns.find(d => d.server === "1.1.1.1")?.status !== "ok" ? ["check.dns_1111.fix.0", "check.dns_1111.fix.1"] : null,
  },
  {
    id: "dns_latency", layer: 5, name: "check.dns_latency.name", description: "Задержка DNS запросов < 100ms",
    hint: "check.dns_latency.hint",
    noDataHint: "nodata.dns_pending",
    staleAfterMs: STALE.s60,
    getValue: s => {
      const latencies = s.dns.filter(d => d.latencyMs != null).map(d => d.latencyMs as number);
      if (!latencies.length) return null;
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      return `${Math.round(avg)}ms`;
    },
    getStatus: s => {
      const latencies = s.dns.filter(d => d.status === "ok" && d.latencyMs != null).map(d => d.latencyMs as number);
      if (!latencies.length) return "unknown";
      const max = Math.max(...latencies);
      return max < 100 ? "ok" : max < 300 ? "warn" : "fail";
    },
    getFix: s => {
      const vals = s.dns.filter(d => d.latencyMs != null).map(d => d.latencyMs as number);
      if (!vals.length) return null;
      const max = Math.max(...vals);
      return max >= 100 ? ["check.dns_latency.fix.0", "check.dns_latency.fix.1", "check.dns_latency.fix.2"] : null;
    },
  },
  {
    id: "dns_consistency", layer: 5, name: "check.dns_consistency.name", description: "Все DNS серверы возвращают одинаковые ответы",
    hint: "check.dns_consistency.hint",
    noDataHint: "nodata.dns_extended_pending",
    staleAfterMs: STALE.m5,
    getValue: s => s.dnsExtra?.consistency ?? null,
    getStatus: s => {
      if (!s.dnsExtra) return "unknown";
      if (isStale(s.dnsExtra.timestamp, STALE.m5)) return "stale";
      return s.dnsExtra.consistency === "ok" ? "ok" : s.dnsExtra.consistency === "mismatch" ? "warn" : "unknown";
    },
    getFix: s => s.dnsExtra?.consistency === "mismatch" ? ["check.dns_consistency.fix.0", "check.dns_consistency.fix.1", "check.dns_consistency.fix.2"] : null,
  },
  {
    id: "nxdomain", layer: 5, name: "check.nxdomain.name", description: "DNS возвращает NXDOMAIN для несуществующих доменов",
    hint: "check.nxdomain.hint",
    noDataHint: "nodata.dns_extended_pending",
    staleAfterMs: STALE.m5,
    getValue: s => s.dnsExtra?.nxdomain ?? null,
    getStatus: s => {
      if (!s.dnsExtra) return "unknown";
      if (isStale(s.dnsExtra.timestamp, STALE.m5)) return "stale";
      return s.dnsExtra.nxdomain === "ok" ? "ok" : "warn";
    },
    getFix: s => s.dnsExtra?.nxdomain === "fail" ? ["check.nxdomain.fix.0", "check.nxdomain.fix.1", "check.nxdomain.fix.2"] : null,
  },
  {
    id: "dns_hijack", layer: 5, name: "check.dns_hijack.name", description: "Нет DNS hijacking — ответы не подменяются",
    hint: "check.dns_hijack.hint",
    noDataHint: "nodata.dns_extended_pending",
    staleAfterMs: STALE.m5,
    getValue: s => s.dnsExtra?.hijacking ?? null,
    getStatus: s => {
      if (!s.dnsExtra) return "unknown";
      if (isStale(s.dnsExtra.timestamp, STALE.m5)) return "stale";
      return s.dnsExtra.hijacking === "ok" ? "ok" : s.dnsExtra.hijacking === "hijacked" ? "fail" : "unknown";
    },
    getFix: s => s.dnsExtra?.hijacking === "hijacked" ? ["check.dns_hijack.fix.0", "check.dns_hijack.fix.1", "check.dns_hijack.fix.2"] : null,
  },
  {
    id: "doh", layer: 5, name: "check.doh.name", description: "DoH через cloudflare-dns.com работает",
    hint: "check.doh.hint",
    noDataHint: "nodata.dns_extended_pending",
    staleAfterMs: STALE.m5,
    getValue: s => s.dnsExtra?.doh ?? null,
    getStatus: s => {
      if (!s.dnsExtra) return "unknown";
      if (isStale(s.dnsExtra.timestamp, STALE.m5)) return "stale";
      return s.dnsExtra.doh === "ok" ? "ok" : s.dnsExtra.doh === "fail" ? "warn" : "unknown";
    },
    getFix: s => s.dnsExtra?.doh === "fail" ? ["check.doh.fix.0", "check.doh.fix.1", "check.doh.fix.2"] : null,
  },

  // ── Layer 6: HTTP / Application ───────────────────────────
  {
    id: "http_google", layer: 6, name: "check.http_google.name", description: "HTTPS до google.com — ответ 200, < 2s",
    hint: "check.http_google.hint",
    noDataHint: "nodata.http_pending",
    staleAfterMs: STALE.s60,
    getValue: s => {
      const h = s.http.find(h => h.url.includes("google"));
      return h?.latencyMs != null ? `${Math.round(h.latencyMs)}ms` : null;
    },
    getStatus: s => {
      const h = s.http.find(h => h.url.includes("google"));
      if (!h) return "unknown";
      if (isStale(h.timestamp, STALE.s60)) return "stale";
      if (!h.statusCode) return "fail";
      return h.latencyMs && h.latencyMs < 2000 ? "ok" : "warn";
    },
    getFix: s => !s.http.find(h => h.url.includes("google"))?.statusCode ? ["check.http_google.fix.0", "check.http_google.fix.1", "check.http_google.fix.2"] : null,
  },
  {
    id: "http_cf", layer: 6, name: "check.http_cf.name", description: "HTTPS до cloudflare.com — ответ 200",
    hint: "check.http_cf.hint",
    noDataHint: "nodata.http_pending",
    staleAfterMs: STALE.s60,
    getValue: s => { const h = s.http.find(h => h.url.includes("cloudflare")); return h?.statusCode ? String(h.statusCode) : null; },
    getStatus: s => {
      const h = s.http.find(h => h.url.includes("cloudflare"));
      if (!h) return "unknown";
      if (isStale(h.timestamp, STALE.s60)) return "stale";
      return h.statusCode && h.statusCode < 400 ? "ok" : "fail";
    },
    getFix: s => !s.http.find(h => h.url.includes("cloudflare"))?.statusCode ? ["check.http_cf.fix.0", "check.http_cf.fix.1"] : null,
  },
  {
    id: "http_github", layer: 6, name: "check.http_github.name", description: "HTTPS до github.com — ответ 200",
    hint: "check.http_github.hint",
    noDataHint: "nodata.http_pending",
    staleAfterMs: STALE.s60,
    getValue: s => { const h = s.http.find(h => h.url.includes("github")); return h?.statusCode ? String(h.statusCode) : null; },
    getStatus: s => {
      const h = s.http.find(h => h.url.includes("github"));
      if (!h) return "unknown";
      if (isStale(h.timestamp, STALE.s60)) return "stale";
      return h.statusCode && h.statusCode < 400 ? "ok" : "fail";
    },
    getFix: s => !s.http.find(h => h.url.includes("github"))?.statusCode ? ["check.http_github.fix.0", "check.http_github.fix.1"] : null,
  },
  {
    id: "http_redirect", layer: 6, name: "check.http_redirect.name", description: "HTTP перенаправляет на HTTPS",
    hint: "check.http_redirect.hint",
    noDataHint: "nodata.http_redirect_pending",
    staleAfterMs: STALE.s60,
    getValue: s => s.httpRedirect?.status ?? null,
    getStatus: s => {
      if (!s.httpRedirect) return "unknown";
      if (isStale(s.httpRedirect.timestamp, STALE.s60)) return "stale";
      return s.httpRedirect.status === "ok" ? "ok" : s.httpRedirect.status === "intercepted" ? "warn" : "fail";
    },
    getFix: s => s.httpRedirect?.status === "intercepted" ? ["check.http_redirect.fix.0", "check.http_redirect.fix.1", "check.http_redirect.fix.2"] : null,
  },
  {
    id: "http_ipv6", layer: 6, name: "check.http_ipv6.name", description: "HTTPS через IPv6 (если доступен)",
    hint: "check.http_ipv6.hint",
    noDataHint: "nodata.ipv6_pending",
    staleAfterMs: STALE.s60,
    getValue: s => s.ipv6?.status ?? null,
    getStatus: s => {
      if (!s.ipv6) return "unknown";
      return s.ipv6?.status === "ok" ? "ok" : "unknown";
    },
    getFix: () => null,
  },
  {
    id: "speedtest", layer: 6, name: "check.speedtest.name", description: "Скорость загрузки/выгрузки",
    hint: "check.speedtest.hint",
    noDataHint: "nodata.speedtest_pending",
    runnable: true, runType: "speedtest",
    staleAfterMs: STALE.h1,
    getValue: s => s.speedtest ? `↓${s.speedtest.downloadMbps.toFixed(1)} ↑${s.speedtest.uploadMbps.toFixed(1)} Mbps` : null,
    getStatus: s => {
      if (!s.speedtest) return "unknown";
      if (isStale(s.speedtest.timestamp, STALE.h1)) return "stale";
      return "ok";
    },
    getFix: () => null,
  },
  {
    id: "captive_portal", layer: 6, name: "check.captive_portal.name", description: "Нет captive portal — сеть открытая",
    hint: "check.captive_portal.hint",
    noDataHint: "nodata.captive_portal_pending",
    staleAfterMs: STALE.s60,
    getValue: s => s.captivePortal?.status ?? null,
    getStatus: s => {
      if (!s.captivePortal) return "unknown";
      if (isStale(s.captivePortal.timestamp, STALE.s60)) return "stale";
      return s.captivePortal.status === "clean" ? "ok" : s.captivePortal.status === "detected" ? "fail" : "unknown";
    },
    getFix: s => s.captivePortal?.status === "detected" ? ["check.captive_portal.fix.0", "check.captive_portal.fix.1", "check.captive_portal.fix.2"] : null,
  },

  // ── Layer 7: Security / Advanced ──────────────────────────
  {
    id: "ssl", layer: 7, name: "check.ssl.name", description: "Все SSL сертификаты действительны > 30 дней",
    hint: "check.ssl.hint",
    noDataHint: "check.ssl.noData",
    staleAfterMs: STALE.h24,
    getValue: s => {
      if (!s.ssl?.length) return null;
      const min = Math.min(...s.ssl.filter(c => c.daysRemaining != null).map(c => c.daysRemaining as number));
      return isFinite(min) ? `${min}d` : null;
    },
    getStatus: s => {
      if (!s.ssl?.length) return "unknown";
      const certs = s.ssl.filter(c => c.daysRemaining != null);
      if (!certs.length) return "unknown";
      if (certs.some(c => c.status === "expired")) return "fail";
      if (certs.some(c => c.status === "warning")) return "warn";
      return "ok";
    },
    getFix: s => s.ssl?.some(c => c.status === "warning" || c.status === "expired") ? ["check.ssl.fix.0", "check.ssl.fix.1", "check.ssl.fix.2"] : null,
  },
  {
    id: "tls_ver", layer: 7, name: "check.tls_ver.name", description: "TLS ≥ 1.2 на всех хостах",
    hint: "check.tls_ver.hint",
    noDataHint: "check.tls_ver.noData",
    staleAfterMs: STALE.h24,
    getValue: s => s.ssl?.length ? "TLS 1.2+" : null,
    getStatus: s => s.ssl?.length ? "ok" : "unknown",
    getFix: () => null,
  },
  {
    id: "path_mtu", layer: 7, name: "check.path_mtu.name", description: "Нет фрагментации пакетов до интернета",
    hint: "check.path_mtu.hint",
    noDataHint: "nodata.mtu_check_pending",
    runnable: true, runType: "mtu",
    staleAfterMs: STALE.m15,
    getValue: s => {
      if (!s.mtu) return null;
      try { const v = JSON.parse(s.mtu.value ?? "{}"); return v.maxMtu ? `${v.maxMtu}` : null; } catch { return null; }
    },
    getStatus: s => {
      if (!s.mtu) return "unknown";
      if (isStale(s.mtu.timestamp, STALE.m15)) return "stale";
      if (s.mtu.status === "error") return "fail";
      return mtuIsOk(s) ? "ok" : "warn";
    },
    getFix: s => (!s.mtu || mtuIsOk(s)) ? null : ["check.path_mtu.fix.0", "check.path_mtu.fix.1", "check.path_mtu.fix.2", "check.path_mtu.fix.3"],
  },
  {
    id: "ipv6_global", layer: 7, name: "check.ipv6_global.name", description: "Глобальное IPv6 подключение работает",
    hint: "check.ipv6_global.hint",
    noDataHint: "nodata.ipv6_pending",
    staleAfterMs: STALE.s30,
    getValue: s => s.ipv6?.status ?? null,
    getStatus: s => {
      if (!s.ipv6) return "unknown";
      if (isStale(s.ipv6.timestamp, STALE.s30)) return "stale";
      return s.ipv6.status === "ok" ? "ok" : "warn";
    },
    getFix: s => s.ipv6?.status !== "ok" ? ["check.ipv6_global.fix.0", "check.ipv6_global.fix.1", "check.ipv6_global.fix.2"] : null,
  },
  {
    id: "ntp", layer: 7, name: "check.ntp.name", description: "Системное время синхронизировано — drift < 5s",
    hint: "check.ntp.hint",
    noDataHint: "nodata.ntp_pending",
    staleAfterMs: STALE.m5,
    getValue: s => s.ntp?.driftMs != null ? `${Math.round(s.ntp.driftMs)}ms` : null,
    getStatus: s => {
      if (!s.ntp) return "unknown";
      if (isStale(s.ntp.timestamp, STALE.m5)) return "stale";
      if (s.ntp.driftMs === null) return "unknown"; // NTP server unreachable, can't measure drift
      return s.ntp.status === "ok" ? "ok" : "warn";
    },
    getFix: s => (s.ntp?.status === "fail" && s.ntp.driftMs !== null) ? ["check.ntp.fix.0", "check.ntp.fix.1", "check.ntp.fix.2"] : null,
  },
  {
    id: "ip_stable", layer: 7, name: "check.ip_stable.name", description: "Публичный IP стабилен последние 24 часа",
    hint: "check.ip_stable.hint",
    noDataHint: "nodata.publicip_stable_pending",
    staleAfterMs: STALE.m5,
    getValue: s => s.publicIp?.ipv4 ?? null,
    getStatus: s => {
      if (!s.publicIp) return "unknown";
      if (isStale(s.publicIp.timestamp, STALE.m5)) return "stale";
      return s.publicIp.changed ? "warn" : "ok";
    },
    getFix: s => s.publicIp?.changed ? ["check.ip_stable.fix.0", "check.ip_stable.fix.1", "check.ip_stable.fix.2"] : null,
  },
  {
    id: "route_stable_sec", layer: 7, name: "check.route_stable_sec.name", description: "Маршрут трассировки не менялся",
    hint: "check.route_stable_sec.hint",
    noDataHint: "nodata.traceroute_pending",
    runnable: true, runType: "traceroute",
    staleAfterMs: STALE.m10,
    getValue: s => s.traceroute ? (s.traceroute.routingChanged ? "ui.value.changed" : "ui.value.stable") : null,
    getStatus: s => {
      if (!s.traceroute) return "unknown";
      if (isStale(s.traceroute.timestamp, STALE.m10)) return "stale";
      return s.traceroute.routingChanged ? "warn" : "ok";
    },
    getFix: s => s.traceroute?.routingChanged ? ["check.route_stable_sec.fix.0", "check.route_stable_sec.fix.1"] : null,
  },
  {
    id: "os_resolver", layer: 7, name: "check.os_resolver.name", description: "/etc/resolv.conf содержит nameserver",
    hint: "check.os_resolver.hint",
    noDataHint: "check.os_resolver.noData",
    staleAfterMs: STALE.m5,
    getValue: s => s.osResolver?.nameservers?.[0] ?? null,
    getStatus: s => {
      if (!s.osResolver) return "unknown";
      if (isStale(s.osResolver.timestamp, STALE.m5)) return "stale";
      return s.osResolver.status === "ok" ? "ok" : "warn";
    },
    getFix: s => s.osResolver?.status === "fail" ? ["check.os_resolver.fix.0", "check.os_resolver.fix.1", "check.os_resolver.fix.2"] : null,
  },
  {
    id: "dns_leak", layer: 7, name: "check.dns_leak.name", description: "DNS запросы не утекают через посторонние серверы",
    hint: "check.dns_leak.hint",
    noDataHint: "nodata.dns_extended_pending",
    staleAfterMs: STALE.m5,
    getValue: s => s.dnsExtra?.dnsLeak ?? null,
    getStatus: s => {
      if (!s.dnsExtra) return "unknown";
      if (isStale(s.dnsExtra.timestamp, STALE.m5)) return "stale";
      return s.dnsExtra.dnsLeak === "ok" ? "ok" : s.dnsExtra.dnsLeak === "leak" ? "warn" : "unknown";
    },
    getFix: s => s.dnsExtra?.dnsLeak === "leak" ? ["check.dns_leak.fix.0", "check.dns_leak.fix.1", "check.dns_leak.fix.2"] : null,
  },
  {
    id: "iface_anomaly", layer: 7, name: "check.iface_anomaly.name", description: "Нет резкого роста ошибок/дропов",
    hint: "check.iface_anomaly.hint",
    noDataHint: "check.iface_anomaly.noData",
    staleAfterMs: STALE.s30,
    getValue: s => s.interface ? `${s.interface.rxErrors + s.interface.txErrors + s.interface.rxDropped + s.interface.txDropped}` : null,
    getStatus: s => {
      if (!s.interface) return "unknown";
      if (isStale(s.interface.timestamp, STALE.s30)) return "stale";
      const total = s.interface.rxErrors + s.interface.txErrors + s.interface.rxDropped + s.interface.txDropped;
      return total === 0 ? "ok" : total < 100 ? "warn" : "fail";
    },
    getFix: s => {
      if (!s.interface) return null;
      const total = s.interface.rxErrors + s.interface.txErrors + s.interface.rxDropped + s.interface.txDropped;
      return total > 0 ? ["check.iface_anomaly.fix.0", "check.iface_anomaly.fix.1", "check.iface_anomaly.fix.2"] : null;
    },
  },
];
