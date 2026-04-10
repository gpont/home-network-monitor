import type { StatusResponse, CheckDefinition, LayerDefinition } from "./types.ts";

export const LAYERS: LayerDefinition[] = [
  { id: 1, name: 'Device / Interface', icon: '🖥' },
  { id: 2, name: 'Gateway / Local', icon: '📡' },
  { id: 3, name: 'ISP / WAN', icon: '🌐' },
  { id: 4, name: 'Internet (L3)', icon: '🌍' },
  { id: 5, name: 'DNS', icon: '🔍' },
  { id: 6, name: 'HTTP / Application', icon: '🌏' },
  { id: 7, name: 'Security / Advanced', icon: '🔐' },
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

function gwPing(s: StatusResponse) {
  // Gateway is the ping target with lowest RTT that is not 8.8.8.8/1.1.1.1/9.9.9.9
  return s.ping.find(p => !["8.8.8.8","1.1.1.1","9.9.9.9"].includes(p.target) && p.targetLabel?.toLowerCase().includes("router"));
}

export const CHECKS: CheckDefinition[] = [
  // ── Layer 1: Device / Interface ──────────────────────────
  {
    id: "iface_up", layer: 1, name: "Интерфейс активен", description: "Сетевой интерфейс в состоянии UP",
    staleAfterMs: STALE.s30,
    getValue: s => s.interface?.interfaceName ?? null,
    getStatus: s => {
      if (!s.interface) return "unknown";
      if (isStale(s.interface.timestamp, STALE.s30)) return "stale";
      return s.interface.status === "up" ? "ok" : s.interface.status === "unknown" ? "unknown" : "fail";
    },
    getFix: s => s.interface?.status === "down" ? ["Проверь кабель или WiFi", "Перезапусти сетевой адаптер", "Проверь статус интерфейса: ip link show"] : null,
  },
  {
    id: "iface_ipv4", layer: 1, name: "IPv4 адрес", description: "IPv4 адрес назначен интерфейсу",
    staleAfterMs: STALE.s30,
    getValue: s => s.interface?.ipv4 ?? null,
    getStatus: s => {
      if (!s.interface) return "unknown";
      if (isStale(s.interface.timestamp, STALE.s30)) return "stale";
      return s.interface.ipv4 ? "ok" : "fail";
    },
    getFix: s => !s.interface?.ipv4 ? ["Проверь DHCP сервер на роутере", "Попробуй: dhclient eth0", "Перезапусти сетевой интерфейс"] : null,
  },
  {
    id: "iface_gateway", layer: 1, name: "Default gateway", description: "Шлюз по умолчанию задан",
    staleAfterMs: STALE.s30,
    getValue: s => s.interface?.gatewayIp ?? null,
    getStatus: s => {
      if (!s.interface) return "unknown";
      if (isStale(s.interface.timestamp, STALE.s30)) return "stale";
      return s.interface.gatewayIp ? "ok" : "fail";
    },
    getFix: s => !s.interface?.gatewayIp ? ["Проверь настройки роутера", "Добавь маршрут: ip route add default via <gateway>"] : null,
  },
  {
    id: "iface_dhcp", layer: 1, name: "DHCP lease", description: "Тип подключения определён (DHCP/PPPoE)",
    staleAfterMs: STALE.m5,
    getValue: s => s.interface?.connectionType ?? null,
    getStatus: s => {
      if (!s.interface) return "unknown";
      if (isStale(s.interface.timestamp, STALE.m5)) return "stale";
      return s.interface.connectionType !== "unknown" ? "ok" : "unknown";
    },
    getFix: s => s.interface?.connectionType === "unknown" ? ["Проверь настройки сети", "Убедись что DHCP включён на роутере"] : null,
  },
  {
    id: "iface_errors", layer: 1, name: "Нет ошибок интерфейса", description: "rx_errors + tx_errors = 0",
    staleAfterMs: STALE.s30,
    getValue: s => s.interface ? String(s.interface.rxErrors + s.interface.txErrors) : null,
    getStatus: s => {
      if (!s.interface) return "unknown";
      if (isStale(s.interface.timestamp, STALE.s30)) return "stale";
      return (s.interface.rxErrors + s.interface.txErrors) === 0 ? "ok" : "warn";
    },
    getFix: s => (s.interface && (s.interface.rxErrors + s.interface.txErrors) > 0) ? ["Проверь кабель/соединение", "Смотри: ethtool eth0"] : null,
  },
  {
    id: "iface_drops", layer: 1, name: "Нет дропов пакетов", description: "rx_dropped + tx_dropped = 0",
    staleAfterMs: STALE.s30,
    getValue: s => s.interface ? String(s.interface.rxDropped + s.interface.txDropped) : null,
    getStatus: s => {
      if (!s.interface) return "unknown";
      if (isStale(s.interface.timestamp, STALE.s30)) return "stale";
      return (s.interface.rxDropped + s.interface.txDropped) === 0 ? "ok" : "warn";
    },
    getFix: s => (s.interface && (s.interface.rxDropped + s.interface.txDropped) > 0) ? ["Возможна перегрузка сети", "Проверь буферы сетевой карты"] : null,
  },
  {
    id: "iface_ipv6_ll", layer: 1, name: "IPv6 link-local", description: "IPv6 link-local адрес (fe80::) назначен",
    staleAfterMs: STALE.s30,
    getValue: s => s.interface?.ipv6LinkLocal ?? null,
    getStatus: s => {
      if (!s.interface) return "unknown";
      if (isStale(s.interface.timestamp, STALE.s30)) return "stale";
      return s.interface.ipv6LinkLocal ? "ok" : "warn";
    },
    getFix: s => !s.interface?.ipv6LinkLocal ? ["IPv6 может быть отключён на интерфейсе", "Проверь: sysctl net.ipv6.conf.all.disable_ipv6"] : null,
  },
  {
    id: "iface_arp", layer: 1, name: "ARP запись шлюза", description: "MAC-адрес шлюза есть в ARP таблице",
    staleAfterMs: STALE.m5,
    getValue: s => s.interface?.gatewayMac ?? null,
    getStatus: s => {
      if (!s.interface) return "unknown";
      if (isStale(s.interface.timestamp, STALE.m5)) return "stale";
      return s.interface.gatewayMac ? "ok" : "warn";
    },
    getFix: s => !s.interface?.gatewayMac ? ["Шлюз не отвечает на ARP", "Проверь: arp -n", "Возможна проблема в локальной сети"] : null,
  },

  // ── Layer 2: Gateway / Local ──────────────────────────────
  {
    id: "gw_ping", layer: 2, name: "Ping шлюза", description: "ICMP ping до роутера — RTT < 5ms",
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
      return gw?.status !== "ok" ? ["Роутер недоступен", "Проверь кабель между сервером и роутером", "Перезагрузи роутер"] : null;
    },
  },
  {
    id: "gw_ping_loss", layer: 2, name: "Стабильность к шлюзу", description: "Потери пакетов до роутера < 1% за 15 мин",
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
      return stats && stats.lossPercent >= 1 ? ["Нестабильная локальная сеть", "Проверь кабель/WiFi сигнал", "Проверь не перегружен ли роутер"] : null;
    },
  },
  {
    id: "gw_dns", layer: 2, name: "DNS роутера", description: "DNS сервер роутера отвечает < 100ms",
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
      return gw?.status !== "ok" ? ["DNS роутера не отвечает", "Перезагрузи роутер", "Временно используй 8.8.8.8 в /etc/resolv.conf"] : null;
    },
  },
  {
    id: "gw_mtu", layer: 2, name: "MTU локальной сети", description: "Нет фрагментации пакетов 1500 байт",
    staleAfterMs: STALE.m15,
    getValue: s => {
      const mtu = s.mtu;
      if (!mtu) return null;
      try { const v = JSON.parse(mtu.value ?? "{}"); return v.maxMtu ? `${v.maxMtu}` : null; } catch { return null; }
    },
    getStatus: s => {
      if (!s.mtu) return "unknown";
      if (isStale(s.mtu.timestamp, STALE.m15)) return "stale";
      return s.mtu.status === "ok" ? "ok" : s.mtu.status === "fragmentation_detected" ? "warn" : "fail";
    },
    getFix: s => s.mtu?.status === "fragmentation_detected" ? ["Проблема MTU — фрагментация", "Проверь настройки MTU на роутере", "Попробуй уменьшить MTU до 1492 (PPPoE)"] : null,
  },
  {
    id: "gw_jitter", layer: 2, name: "Jitter до шлюза", description: "Нестабильность RTT до роутера < 5ms",
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
      return stats?.jitterMs != null && stats.jitterMs >= 5 ? ["Нестабильный WiFi или кабель", "Попробуй другой порт на роутере", "Уменьши нагрузку на сеть"] : null;
    },
  },
  {
    id: "iface_speed", layer: 2, name: "Скорость интерфейса", description: "Информация об интерфейсе (информационный чек)",
    staleAfterMs: STALE.s30,
    getValue: s => {
      if (!s.networkStats?.length) return null;
      return s.interface?.interfaceName ?? null;
    },
    getStatus: s => s.networkStats?.length ? "info" : "unknown",
    getFix: () => null,
  },

  // ── Layer 3: ISP / WAN ────────────────────────────────────
  {
    id: "isp_hop", layer: 3, name: "ISP первый хоп", description: "Первый хоп провайдера доступен",
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
    id: "isp_hop_rtt", layer: 3, name: "RTT до ISP хопа", description: "Задержка до первого хопа провайдера < 20ms",
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
      return isp ? ["Высокая задержка у провайдера", "Свяжись с провайдером", "Проверь качество линии"] : null;
    },
  },
  {
    id: "wan_type", layer: 3, name: "Тип WAN", description: "Тип подключения к провайдеру определён",
    staleAfterMs: STALE.m5,
    getValue: s => s.interface?.connectionType ?? null,
    getStatus: s => {
      if (!s.interface) return "unknown";
      return s.interface.connectionType !== "unknown" ? "info" : "unknown";
    },
    getFix: () => null,
  },
  {
    id: "cgnat", layer: 3, name: "Нет CGNAT", description: "Публичный IP — не за CGNAT провайдера",
    staleAfterMs: STALE.h1,
    getValue: s => s.cgnat?.status ?? null,
    getStatus: s => {
      if (!s.cgnat) return "unknown";
      if (isStale(s.cgnat.timestamp, STALE.h1)) return "stale";
      return s.cgnat.status === "direct" ? "ok" : s.cgnat.status === "cgnat" ? "warn" : "unknown";
    },
    getFix: s => s.cgnat?.status === "cgnat" ? ["Ты за CGNAT провайдера", "Port forwarding не будет работать", "Запроси у провайдера выделенный IP"] : null,
  },
  {
    id: "public_ip", layer: 3, name: "Публичный IP", description: "Публичный IPv4 адрес получен",
    staleAfterMs: STALE.m5,
    getValue: s => s.publicIp?.ipv4 ?? null,
    getStatus: s => {
      if (!s.publicIp) return "unknown";
      if (isStale(s.publicIp.timestamp, STALE.m5)) return "stale";
      return s.publicIp.ipv4 ? "ok" : "fail";
    },
    getFix: s => !s.publicIp?.ipv4 ? ["Публичный IP не определён", "Проверь интернет-подключение", "Проверь настройки роутера"] : null,
  },
  {
    id: "route_stable", layer: 3, name: "Маршрут стабилен", description: "Маршрут трассировки не изменился",
    staleAfterMs: STALE.m10,
    getValue: s => s.traceroute ? (s.traceroute.routingChanged ? "изменён" : "стабилен") : null,
    getStatus: s => {
      if (!s.traceroute) return "unknown";
      if (isStale(s.traceroute.timestamp, STALE.m10)) return "stale";
      return s.traceroute.routingChanged ? "warn" : "ok";
    },
    getFix: s => s.traceroute?.routingChanged ? ["Маршрут изменился", "Возможно переключение у провайдера", "Наблюдай за стабильностью"] : null,
  },
  {
    id: "isp_dns", layer: 3, name: "DNS провайдера", description: "Информация о DNS провайдера",
    staleAfterMs: STALE.s60,
    getValue: s => s.osResolver?.nameservers?.[0] ?? null,
    getStatus: s => {
      if (!s.osResolver) return "unknown";
      return s.osResolver.status === "ok" ? "info" : "unknown";
    },
    getFix: () => null,
  },

  // ── Layer 4: Internet (L3) ────────────────────────────────
  {
    id: "ping_8888", layer: 4, name: "Ping 8.8.8.8", description: "ICMP ping до Google DNS — RTT < 50ms",
    staleAfterMs: STALE.s30,
    getValue: s => { const p = pingFor(s, "8.8.8.8"); return p?.rttMs != null ? `${p.rttMs.toFixed(1)}ms` : null; },
    getStatus: s => {
      const p = pingFor(s, "8.8.8.8");
      if (!p) return "unknown";
      if (isStale(p.timestamp, STALE.s30)) return "stale";
      if (p.status !== "ok") return "fail";
      return (p.rttMs ?? 999) < 50 ? "ok" : "warn";
    },
    getFix: s => pingFor(s, "8.8.8.8")?.status !== "ok" ? ["Нет связи с интернетом", "Проверь кабель провайдера", "Перезагрузи роутер"] : null,
  },
  {
    id: "ping_1111", layer: 4, name: "Ping 1.1.1.1", description: "ICMP ping до Cloudflare DNS — RTT < 50ms",
    staleAfterMs: STALE.s30,
    getValue: s => { const p = pingFor(s, "1.1.1.1"); return p?.rttMs != null ? `${p.rttMs.toFixed(1)}ms` : null; },
    getStatus: s => {
      const p = pingFor(s, "1.1.1.1");
      if (!p) return "unknown";
      if (isStale(p.timestamp, STALE.s30)) return "stale";
      if (p.status !== "ok") return "fail";
      return (p.rttMs ?? 999) < 50 ? "ok" : "warn";
    },
    getFix: s => pingFor(s, "1.1.1.1")?.status !== "ok" ? ["Нет связи с интернетом (Cloudflare)", "Проверь интернет-подключение"] : null,
  },
  {
    id: "ping_9999", layer: 4, name: "Ping 9.9.9.9", description: "ICMP ping до Quad9 DNS — RTT < 100ms",
    staleAfterMs: STALE.s30,
    getValue: s => { const p = pingFor(s, "9.9.9.9"); return p?.rttMs != null ? `${p.rttMs.toFixed(1)}ms` : null; },
    getStatus: s => {
      const p = pingFor(s, "9.9.9.9");
      if (!p) return "unknown";
      if (isStale(p.timestamp, STALE.s30)) return "stale";
      if (p.status !== "ok") return "fail";
      return (p.rttMs ?? 999) < 100 ? "ok" : "warn";
    },
    getFix: s => pingFor(s, "9.9.9.9")?.status !== "ok" ? ["Нет связи с Quad9", "Проверь интернет-подключение"] : null,
  },
  {
    id: "tcp_443", layer: 4, name: "TCP connect 443", description: "TCP соединение к 1.1.1.1:443 успешно",
    staleAfterMs: STALE.s30,
    getValue: s => s.tcpConnect?.latencyMs != null ? `${Math.round(s.tcpConnect.latencyMs)}ms` : null,
    getStatus: s => {
      if (!s.tcpConnect) return "unknown";
      if (isStale(s.tcpConnect.timestamp, STALE.s30)) return "stale";
      return s.tcpConnect.status === "ok" ? "ok" : "fail";
    },
    getFix: s => s.tcpConnect?.status !== "ok" ? ["TCP порт 443 недоступен", "Возможна блокировка фаерволом", "Проверь настройки роутера"] : null,
  },
  {
    id: "pkt_loss", layer: 4, name: "Packet loss", description: "Потери пакетов < 1% за 15 минут",
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
      return max >= 1 ? ["Нестабильное соединение", "Проверь кабель провайдера", "Свяжись с провайдером"] : null;
    },
  },
  {
    id: "jitter", layer: 4, name: "Jitter (нестабильность)", description: "Нестабильность RTT до интернета < 10ms",
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
      return p8?.jitterMs != null && p8.jitterMs >= 10 ? ["Нестабильный интернет", "Проверь качество линии провайдера", "Смотри: mtr 8.8.8.8"] : null;
    },
  },
  {
    id: "no_blackhole", layer: 4, name: "Нет black hole", description: "В traceroute нет 3+ подряд пропущенных хопов",
    staleAfterMs: STALE.m10,
    getValue: s => s.traceroute ? ((s.traceroute as any).hasBlackHole ? "обнаружен" : "нет") : null,
    getStatus: s => {
      if (!s.traceroute) return "unknown";
      if (isStale(s.traceroute.timestamp, STALE.m10)) return "stale";
      return (s.traceroute as any).hasBlackHole ? "warn" : "ok";
    },
    getFix: s => (s.traceroute as any)?.hasBlackHole ? ["Обнаружен black hole в сети", "Возможна фильтрация ICMP провайдером", "Проверь traceroute вручную"] : null,
  },

  // ── Layer 5: DNS ──────────────────────────────────────────
  {
    id: "dns_gw", layer: 5, name: "DNS роутера резолвит", description: "DNS сервер роутера возвращает корректный ответ",
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
      return d?.status !== "ok" ? ["DNS роутера сломан", "Перезагрузи роутер", "Временно поменяй DNS на 8.8.8.8"] : null;
    },
  },
  {
    id: "dns_8888", layer: 5, name: "DNS 8.8.8.8", description: "Google Public DNS отвечает корректно",
    staleAfterMs: STALE.s60,
    getValue: s => { const d = s.dns.find(d => d.server === "8.8.8.8"); return d?.latencyMs != null ? `${Math.round(d.latencyMs)}ms` : null; },
    getStatus: s => {
      const d = s.dns.find(d => d.server === "8.8.8.8");
      if (!d) return "unknown";
      if (isStale(d.timestamp, STALE.s60)) return "stale";
      return d.status === "ok" ? "ok" : "fail";
    },
    getFix: s => s.dns.find(d => d.server === "8.8.8.8")?.status !== "ok" ? ["DNS 8.8.8.8 недоступен", "Проблема с интернетом или блокировка"] : null,
  },
  {
    id: "dns_1111", layer: 5, name: "DNS 1.1.1.1", description: "Cloudflare DNS отвечает корректно",
    staleAfterMs: STALE.s60,
    getValue: s => { const d = s.dns.find(d => d.server === "1.1.1.1"); return d?.latencyMs != null ? `${Math.round(d.latencyMs)}ms` : null; },
    getStatus: s => {
      const d = s.dns.find(d => d.server === "1.1.1.1");
      if (!d) return "unknown";
      if (isStale(d.timestamp, STALE.s60)) return "stale";
      return d.status === "ok" ? "ok" : "fail";
    },
    getFix: s => s.dns.find(d => d.server === "1.1.1.1")?.status !== "ok" ? ["DNS 1.1.1.1 недоступен", "Проблема с интернетом или блокировка"] : null,
  },
  {
    id: "dns_latency", layer: 5, name: "DNS задержка", description: "Задержка DNS запросов < 100ms",
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
      return max >= 100 ? ["Высокая задержка DNS", "Используй более быстрый DNS сервер", "Проверь нагрузку на сеть"] : null;
    },
  },
  {
    id: "dns_consistency", layer: 5, name: "DNS согласованность", description: "Все DNS серверы возвращают одинаковые ответы",
    staleAfterMs: STALE.m5,
    getValue: s => s.dnsExtra?.consistency ?? null,
    getStatus: s => {
      if (!s.dnsExtra) return "unknown";
      if (isStale(s.dnsExtra.timestamp, STALE.m5)) return "stale";
      return s.dnsExtra.consistency === "ok" ? "ok" : s.dnsExtra.consistency === "mismatch" ? "warn" : "unknown";
    },
    getFix: s => s.dnsExtra?.consistency === "mismatch" ? ["DNS серверы дают разные ответы", "Возможен DNS hijacking или проблема с кешем", "Проверь настройки DNS роутера"] : null,
  },
  {
    id: "nxdomain", layer: 5, name: "NXDOMAIN корректен", description: "DNS возвращает NXDOMAIN для несуществующих доменов",
    staleAfterMs: STALE.m5,
    getValue: s => s.dnsExtra?.nxdomain ?? null,
    getStatus: s => {
      if (!s.dnsExtra) return "unknown";
      if (isStale(s.dnsExtra.timestamp, STALE.m5)) return "stale";
      return s.dnsExtra.nxdomain === "ok" ? "ok" : "warn";
    },
    getFix: s => s.dnsExtra?.nxdomain === "fail" ? ["DNS не возвращает NXDOMAIN", "Роутер или провайдер перехватывает DNS запросы", "Используй DNS через DoH"] : null,
  },
  {
    id: "dns_hijack", layer: 5, name: "DNS не перехвачен", description: "Нет DNS hijacking — ответы не подменяются",
    staleAfterMs: STALE.m5,
    getValue: s => s.dnsExtra?.hijacking ?? null,
    getStatus: s => {
      if (!s.dnsExtra) return "unknown";
      if (isStale(s.dnsExtra.timestamp, STALE.m5)) return "stale";
      return s.dnsExtra.hijacking === "ok" ? "ok" : s.dnsExtra.hijacking === "hijacked" ? "fail" : "unknown";
    },
    getFix: s => s.dnsExtra?.hijacking === "hijacked" ? ["Обнаружен DNS hijacking", "DNS запросы перехватываются", "Используй DNS-over-HTTPS или VPN"] : null,
  },
  {
    id: "doh", layer: 5, name: "DNS over HTTPS", description: "DoH через cloudflare-dns.com работает",
    staleAfterMs: STALE.m5,
    getValue: s => s.dnsExtra?.doh ?? null,
    getStatus: s => {
      if (!s.dnsExtra) return "unknown";
      if (isStale(s.dnsExtra.timestamp, STALE.m5)) return "stale";
      return s.dnsExtra.doh === "ok" ? "ok" : s.dnsExtra.doh === "fail" ? "warn" : "unknown";
    },
    getFix: s => s.dnsExtra?.doh === "fail" ? ["DoH недоступен", "HTTPS к cloudflare-dns.com заблокирован", "Проверь фаервол и блокировки"] : null,
  },

  // ── Layer 6: HTTP / Application ───────────────────────────
  {
    id: "http_google", layer: 6, name: "HTTP google.com", description: "HTTPS до google.com — ответ 200, < 2s",
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
    getFix: s => !s.http.find(h => h.url.includes("google"))?.statusCode ? ["google.com недоступен", "Проверь интернет и DNS", "Возможна блокировка"] : null,
  },
  {
    id: "http_cf", layer: 6, name: "HTTP cloudflare.com", description: "HTTPS до cloudflare.com — ответ 200",
    staleAfterMs: STALE.s60,
    getValue: s => { const h = s.http.find(h => h.url.includes("cloudflare")); return h?.statusCode ? String(h.statusCode) : null; },
    getStatus: s => {
      const h = s.http.find(h => h.url.includes("cloudflare"));
      if (!h) return "unknown";
      if (isStale(h.timestamp, STALE.s60)) return "stale";
      return h.statusCode && h.statusCode < 400 ? "ok" : "fail";
    },
    getFix: s => !s.http.find(h => h.url.includes("cloudflare"))?.statusCode ? ["cloudflare.com недоступен", "Проверь интернет-подключение"] : null,
  },
  {
    id: "http_github", layer: 6, name: "HTTP github.com", description: "HTTPS до github.com — ответ 200",
    staleAfterMs: STALE.s60,
    getValue: s => { const h = s.http.find(h => h.url.includes("github")); return h?.statusCode ? String(h.statusCode) : null; },
    getStatus: s => {
      const h = s.http.find(h => h.url.includes("github"));
      if (!h) return "unknown";
      if (isStale(h.timestamp, STALE.s60)) return "stale";
      return h.statusCode && h.statusCode < 400 ? "ok" : "fail";
    },
    getFix: s => !s.http.find(h => h.url.includes("github"))?.statusCode ? ["github.com недоступен", "Проверь интернет-подключение"] : null,
  },
  {
    id: "http_redirect", layer: 6, name: "HTTP redirect → HTTPS", description: "HTTP перенаправляет на HTTPS",
    staleAfterMs: STALE.s60,
    getValue: s => s.httpRedirect?.status ?? null,
    getStatus: s => {
      if (!s.httpRedirect) return "unknown";
      if (isStale(s.httpRedirect.timestamp, STALE.s60)) return "stale";
      return s.httpRedirect.status === "ok" ? "ok" : s.httpRedirect.status === "intercepted" ? "warn" : "fail";
    },
    getFix: s => s.httpRedirect?.status === "intercepted" ? ["HTTP трафик перехватывается", "Возможен captive portal или прокси", "Проверь настройки сети"] : null,
  },
  {
    id: "http_ipv6", layer: 6, name: "IPv6 HTTP", description: "HTTPS через IPv6 (если доступен)",
    staleAfterMs: STALE.s60,
    getValue: s => s.ipv6?.status ?? null,
    getStatus: s => {
      if (!s.ipv6) return "unknown";
      return s.ipv6.status === "ok" ? "info" : "info";
    },
    getFix: () => null,
  },
  {
    id: "speedtest", layer: 6, name: "Speedtest", description: "Скорость загрузки/выгрузки",
    staleAfterMs: STALE.h1,
    getValue: s => s.speedtest ? `↓${s.speedtest.downloadMbps.toFixed(1)} ↑${s.speedtest.uploadMbps.toFixed(1)} Mbps` : null,
    getStatus: s => {
      if (!s.speedtest) return "unknown";
      if (isStale(s.speedtest.timestamp, STALE.h1)) return "stale";
      return "info";
    },
    getFix: () => null,
  },
  {
    id: "captive_portal", layer: 6, name: "Captive portal", description: "Нет captive portal — сеть открытая",
    staleAfterMs: STALE.s60,
    getValue: s => s.captivePortal?.status ?? null,
    getStatus: s => {
      if (!s.captivePortal) return "unknown";
      if (isStale(s.captivePortal.timestamp, STALE.s60)) return "stale";
      return s.captivePortal.status === "clean" ? "ok" : s.captivePortal.status === "detected" ? "fail" : "unknown";
    },
    getFix: s => s.captivePortal?.status === "detected" ? ["Обнаружен captive portal", "Открой браузер и пройди авторизацию", "Проверь нет ли прокси-сервера"] : null,
  },

  // ── Layer 7: Security / Advanced ──────────────────────────
  {
    id: "ssl", layer: 7, name: "SSL сертификаты", description: "Все SSL сертификаты действительны > 30 дней",
    staleAfterMs: STALE.h24,
    getValue: s => {
      if (!s.ssl?.length) return null;
      const min = Math.min(...s.ssl.filter(c => c.daysRemaining != null).map(c => c.daysRemaining as number));
      return isFinite(min) ? `${min}д` : null;
    },
    getStatus: s => {
      if (!s.ssl?.length) return "unknown";
      const certs = s.ssl.filter(c => c.daysRemaining != null);
      if (!certs.length) return "unknown";
      if (certs.some(c => c.status === "expired")) return "fail";
      if (certs.some(c => c.status === "warning")) return "warn";
      return "ok";
    },
    getFix: s => s.ssl?.some(c => c.status === "warning" || c.status === "expired") ? ["SSL сертификат истекает", "Обнови сертификат", "Проверь Let's Encrypt автообновление"] : null,
  },
  {
    id: "tls_ver", layer: 7, name: "TLS версия", description: "TLS ≥ 1.2 на всех хостах",
    staleAfterMs: STALE.h24,
    getValue: s => s.ssl?.length ? "TLS 1.2+" : null,
    getStatus: s => s.ssl?.length ? "info" : "unknown",
    getFix: () => null,
  },
  {
    id: "path_mtu", layer: 7, name: "Path MTU", description: "Нет фрагментации пакетов до интернета",
    staleAfterMs: STALE.m15,
    getValue: s => {
      if (!s.mtu) return null;
      try { const v = JSON.parse(s.mtu.value ?? "{}"); return v.maxMtu ? `${v.maxMtu}` : null; } catch { return null; }
    },
    getStatus: s => {
      if (!s.mtu) return "unknown";
      if (isStale(s.mtu.timestamp, STALE.m15)) return "stale";
      return s.mtu.status === "ok" ? "ok" : s.mtu.status === "fragmentation_detected" ? "warn" : "fail";
    },
    getFix: s => s.mtu?.status !== "ok" ? ["MTU проблема", "Уменьши MTU до 1492 (PPPoE) или 1480 (tunnel)", "Проверь настройки роутера"] : null,
  },
  {
    id: "ipv6_global", layer: 7, name: "IPv6 глобальный", description: "Глобальное IPv6 подключение работает",
    staleAfterMs: STALE.s30,
    getValue: s => s.ipv6?.status ?? null,
    getStatus: s => {
      if (!s.ipv6) return "unknown";
      if (isStale(s.ipv6.timestamp, STALE.s30)) return "stale";
      return s.ipv6.status === "ok" ? "ok" : "info";
    },
    getFix: s => s.ipv6?.status !== "ok" ? ["IPv6 недоступен", "Узнай у провайдера поддержку IPv6", "Настрой IPv6 tunnel (6in4)"] : null,
  },
  {
    id: "ntp", layer: 7, name: "NTP синхронизация", description: "Системное время синхронизировано — drift < 5s",
    staleAfterMs: STALE.m5,
    getValue: s => s.ntp?.driftMs != null ? `${Math.round(s.ntp.driftMs)}ms` : null,
    getStatus: s => {
      if (!s.ntp) return "unknown";
      if (isStale(s.ntp.timestamp, STALE.m5)) return "stale";
      return s.ntp.status === "ok" ? "ok" : "warn";
    },
    getFix: s => s.ntp?.status === "fail" ? ["NTP не синхронизирован", "Проверь: systemctl status systemd-timesyncd", "Или: ntpdate pool.ntp.org"] : null,
  },
  {
    id: "ip_stable", layer: 7, name: "IP не меняется", description: "Публичный IP стабилен последние 24 часа",
    staleAfterMs: STALE.m5,
    getValue: s => s.publicIp?.ipv4 ?? null,
    getStatus: s => {
      if (!s.publicIp) return "unknown";
      if (isStale(s.publicIp.timestamp, STALE.m5)) return "stale";
      return s.publicIp.changed ? "warn" : "ok";
    },
    getFix: s => s.publicIp?.changed ? ["Публичный IP изменился", "Динамический IP — нормально для домашней сети", "Рассмотри DDNS если нужен стабильный адрес"] : null,
  },
  {
    id: "route_stable_sec", layer: 7, name: "Routing стабилен", description: "Маршрут трассировки не менялся",
    staleAfterMs: STALE.m10,
    getValue: s => s.traceroute ? (s.traceroute.routingChanged ? "изменён" : "стабилен") : null,
    getStatus: s => {
      if (!s.traceroute) return "unknown";
      if (isStale(s.traceroute.timestamp, STALE.m10)) return "stale";
      return s.traceroute.routingChanged ? "warn" : "ok";
    },
    getFix: s => s.traceroute?.routingChanged ? ["Маршрут изменился", "Возможны технические работы у провайдера"] : null,
  },
  {
    id: "os_resolver", layer: 7, name: "OS резолвер", description: "/etc/resolv.conf содержит nameserver",
    staleAfterMs: STALE.m5,
    getValue: s => s.osResolver?.nameservers?.[0] ?? null,
    getStatus: s => {
      if (!s.osResolver) return "unknown";
      if (isStale(s.osResolver.timestamp, STALE.m5)) return "stale";
      return s.osResolver.status === "ok" ? "ok" : "warn";
    },
    getFix: s => s.osResolver?.status === "fail" ? ["/etc/resolv.conf пустой или отсутствует", "Добавь: nameserver 8.8.8.8", "Проверь сетевые настройки системы"] : null,
  },
  {
    id: "dns_leak", layer: 7, name: "DNS leak", description: "DNS запросы не утекают через посторонние серверы",
    staleAfterMs: STALE.m5,
    getValue: s => s.dnsExtra?.dnsLeak ?? null,
    getStatus: s => {
      if (!s.dnsExtra) return "unknown";
      if (isStale(s.dnsExtra.timestamp, STALE.m5)) return "stale";
      return s.dnsExtra.dnsLeak === "ok" ? "ok" : s.dnsExtra.dnsLeak === "leak" ? "warn" : "unknown";
    },
    getFix: s => s.dnsExtra?.dnsLeak === "leak" ? ["Обнаружена утечка DNS", "DNS запросы идут через неожиданный сервер", "Используй VPN с DNS leak protection"] : null,
  },
  {
    id: "iface_anomaly", layer: 7, name: "Аномалии интерфейса", description: "Нет резкого роста ошибок/дропов",
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
      return total > 0 ? ["Аномалии в статистике интерфейса", "Проверь физическое соединение", "Смотри: ip -s link show"] : null;
    },
  },
];
