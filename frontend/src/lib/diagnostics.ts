import type { StatusResponse, DiagnosticRule } from "./types.ts";

function gwOk(s: StatusResponse): boolean {
  const gw = s.ping.find(p => p.targetLabel?.toLowerCase().includes("router") || (!["8.8.8.8","1.1.1.1","9.9.9.9"].includes(p.target)));
  return gw?.status === "ok";
}

function internetFail(s: StatusResponse): boolean {
  const p8 = s.ping.find(p => p.target === "8.8.8.8");
  const p1 = s.ping.find(p => p.target === "1.1.1.1");
  return (p8?.status !== "ok") && (p1?.status !== "ok");
}

const RULES: DiagnosticRule[] = [
  {
    id: "R1", severity: "critical",
    title: "Полный обрыв сети",
    description: "Нет связи ни с роутером, ни с интернетом",
    steps: ["Проверь кабель питания роутера", "Проверь кабель между сервером и роутером", "Перезагрузи роутер", "Проверь статус интерфейса: ip link show"],
    condition: s => {
      const gwFail = !gwOk(s) && s.ping.length > 0;
      const netFail = internetFail(s);
      const dnsFail = s.dns.every(d => d.status !== "ok");
      return gwFail && netFail && dnsFail;
    },
  },
  {
    id: "R2", severity: "critical",
    title: "Роутер недоступен",
    description: "Интерфейс поднят, но роутер не отвечает на ping и ARP",
    steps: ["Проверь кабель между сервером и роутером", "Убедись что роутер включён", "Попробуй: arp -n", "Перезагрузи роутер"],
    condition: s => {
      if (!gwOk(s) && s.ping.length > 0) {
        const ifaceUp = s.interface?.status === "up";
        const noArp = !s.interface?.gatewayMac;
        return ifaceUp && noArp;
      }
      return false;
    },
  },
  {
    id: "R3", severity: "critical",
    title: "Нет интернета — проблема у провайдера",
    description: "Роутер доступен, но интернет недоступен",
    steps: ["Позвони провайдеру", "Проверь статус оборудования провайдера", "Попробуй перезагрузить роутер", "Проверь баланс на счёте"],
    condition: s => gwOk(s) && internetFail(s),
  },
  {
    id: "R4", severity: "warning",
    title: "DNS не работает, IP-связь есть",
    description: "Ping и TCP работают, но все DNS серверы не отвечают",
    steps: ["Временно поменяй DNS: echo 'nameserver 8.8.8.8' > /etc/resolv.conf", "Перезагрузи роутер", "Проверь настройки DNS на роутере"],
    condition: s => {
      const p8 = s.ping.find(p => p.target === "8.8.8.8");
      const tcpOk = s.tcpConnect?.status === "ok";
      const allDnsFail = s.dns.length > 0 && s.dns.every(d => d.status !== "ok");
      return p8?.status === "ok" && tcpOk && allDnsFail;
    },
  },
  {
    id: "R5", severity: "warning",
    title: "DNS роутера сломан, внешние работают",
    description: "DNS роутера не отвечает, 8.8.8.8 работает",
    steps: ["Перезагрузи роутер", "Измени DNS на роутере на 8.8.8.8", "Временно используй внешний DNS"],
    condition: s => {
      const gwDns = s.dns.find(d => !["8.8.8.8","1.1.1.1"].includes(d.server));
      const extDns = s.dns.find(d => d.server === "8.8.8.8");
      return gwDns?.status !== "ok" && extDns?.status === "ok";
    },
  },
  {
    id: "R6", severity: "warning",
    title: "DNS hijacking — перехват запросов",
    description: "DNS запросы перехватываются или NXDOMAIN не работает",
    steps: ["Используй DNS-over-HTTPS", "Включи DoH в браузере", "Рассмотри использование VPN", "Проверь настройки роутера"],
    condition: s => s.dnsExtra?.hijacking === "hijacked" || s.dnsExtra?.nxdomain === "fail",
  },
  {
    id: "R7", severity: "warning",
    title: "Нестабильное соединение — потери пакетов",
    description: "Packet loss > 5% за последние 15 минут",
    steps: ["Проверь кабель провайдера", "Свяжись с провайдером", "Проверь качество WiFi сигнала", "Смотри: mtr 8.8.8.8"],
    condition: s => {
      if (!s.pingStats) return false;
      const maxLoss = Math.max(...Object.values(s.pingStats.targets).map(t => t.lossPercent));
      return maxLoss > 5;
    },
  },
  {
    id: "R8", severity: "warning",
    title: "Проблема MTU — фрагментация",
    description: "Обнаружена фрагментация пакетов",
    steps: ["Уменьши MTU до 1492 (PPPoE)", "Уменьши MTU до 1480 (tunnel)", "Проверь настройки MTU на роутере", "Команда: ip link set eth0 mtu 1492"],
    condition: s => s.mtu?.status === "fragmentation_detected" || s.mtu?.status === "error",
  },
  {
    id: "R9", severity: "info",
    title: "CGNAT — ты за NAT провайдера",
    description: "Твой публичный IP принадлежит провайдеру (100.64.0.0/10)",
    steps: ["Port forwarding не будет работать", "Запроси у провайдера выделенный IP", "Рассмотри VPN с port forwarding"],
    condition: s => s.cgnat?.status === "cgnat",
  },
  {
    id: "R10", severity: "warning",
    title: "HTTP заблокирован",
    description: "Ping и DNS работают, но HTTP/HTTPS заблокирован",
    steps: ["Проверь настройки фаервола", "Попробуй другой браузер", "Возможна блокировка провайдером", "Рассмотри использование VPN"],
    condition: s => {
      const p8 = s.ping.find(p => p.target === "8.8.8.8");
      const extDns = s.dns.find(d => d.server === "8.8.8.8");
      const httpFail = s.http.length > 0 && s.http.every(h => !h.statusCode);
      return p8?.status === "ok" && s.tcpConnect?.status === "ok" && extDns?.status === "ok" && httpFail;
    },
  },
  {
    id: "R11", severity: "info",
    title: "IPv6 не работает",
    description: "IPv4 работает, IPv6 недоступен",
    steps: ["Узнай у провайдера поддержку IPv6", "Настрой IPv6 tunnel (Hurricane Electric)", "Или игнорируй — IPv4 достаточно"],
    condition: s => {
      const p8 = s.ping.find(p => p.target === "8.8.8.8");
      return p8?.status === "ok" && s.ipv6?.status !== "ok" && s.ipv6 !== null;
    },
  },
  {
    id: "R12", severity: "warning",
    title: "Высокая задержка у провайдера",
    description: "Шлюз близко, но первый хоп провайдера далеко",
    steps: ["Свяжись с провайдером", "Проверь качество линии", "Запроси диагностику у провайдера"],
    condition: s => {
      const gw = s.ping.find(p => p.targetLabel?.toLowerCase().includes("router"));
      if (!gw || !s.traceroute) return false;
      const rfc1918 = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;
      const ispHop = s.traceroute.hops.find(h => h.ip && !rfc1918.test(h.ip));
      return (gw.rttMs ?? 999) < 3 && (ispHop?.rttMs ?? 0) > 50;
    },
  },
];

export function evaluate(s: StatusResponse): DiagnosticRule[] {
  const triggered = RULES.filter(r => {
    try { return r.condition(s); } catch { return false; }
  });
  const order = { critical: 0, warning: 1, info: 2 };
  return triggered.sort((a, b) => order[a.severity] - order[b.severity]);
}

export { RULES };
