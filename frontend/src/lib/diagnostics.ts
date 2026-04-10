import type { StatusResponse, DiagnosticRule, PingStatsEntry } from "./types.ts";

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
    title: "diag.R1.title",
    description: "diag.R1.desc",
    steps: ["diag.R1.step.0", "diag.R1.step.1", "diag.R1.step.2", "diag.R1.step.3"],
    condition: s => {
      const gwFail = !gwOk(s) && s.ping.length > 0;
      const netFail = internetFail(s);
      const dnsFail = s.dns.every(d => d.status !== "ok");
      return gwFail && netFail && dnsFail;
    },
  },
  {
    id: "R2", severity: "critical",
    title: "diag.R2.title",
    description: "diag.R2.desc",
    steps: ["diag.R2.step.0", "diag.R2.step.1", "diag.R2.step.2", "diag.R2.step.3"],
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
    title: "diag.R3.title",
    description: "diag.R3.desc",
    steps: ["diag.R3.step.0", "diag.R3.step.1", "diag.R3.step.2", "diag.R3.step.3"],
    condition: s => gwOk(s) && internetFail(s),
  },
  {
    id: "R4", severity: "warning",
    title: "diag.R4.title",
    description: "diag.R4.desc",
    steps: ["diag.R4.step.0", "diag.R4.step.1", "diag.R4.step.2"],
    condition: s => {
      const p8 = s.ping.find(p => p.target === "8.8.8.8");
      const tcpOk = s.tcpConnect?.status === "ok";
      const allDnsFail = s.dns.length > 0 && s.dns.every(d => d.status !== "ok");
      return p8?.status === "ok" && tcpOk && allDnsFail;
    },
  },
  {
    id: "R5", severity: "warning",
    title: "diag.R5.title",
    description: "diag.R5.desc",
    steps: ["diag.R5.step.0", "diag.R5.step.1", "diag.R5.step.2"],
    condition: s => {
      const gwDns = s.dns.find(d => !["8.8.8.8","1.1.1.1"].includes(d.server));
      const extDns = s.dns.find(d => d.server === "8.8.8.8");
      return gwDns?.status !== "ok" && extDns?.status === "ok";
    },
  },
  {
    id: "R6", severity: "warning",
    title: "diag.R6.title",
    description: "diag.R6.desc",
    steps: ["diag.R6.step.0", "diag.R6.step.1", "diag.R6.step.2", "diag.R6.step.3"],
    condition: s => s.dnsExtra?.hijacking === "hijacked" || s.dnsExtra?.nxdomain === "fail",
  },
  {
    id: "R7", severity: "warning",
    title: "diag.R7.title",
    description: "diag.R7.desc",
    steps: ["diag.R7.step.0", "diag.R7.step.1", "diag.R7.step.2", "diag.R7.step.3"],
    condition: s => {
      if (!s.pingStats) return false;
      const maxLoss = Math.max(...Object.values(s.pingStats).map((t: PingStatsEntry) => t.lossPercent));
      return maxLoss > 5;
    },
  },
  {
    id: "R8", severity: "warning",
    title: "diag.R8.title",
    description: "diag.R8.desc",
    steps: ["diag.R8.step.0", "diag.R8.step.1", "diag.R8.step.2", "diag.R8.step.3"],
    condition: s => s.mtu?.status === "fragmentation_detected" || s.mtu?.status === "error",
  },
  {
    id: "R9", severity: "info",
    title: "diag.R9.title",
    description: "diag.R9.desc",
    steps: ["diag.R9.step.0", "diag.R9.step.1", "diag.R9.step.2"],
    condition: s => s.cgnat?.status === "cgnat",
  },
  {
    id: "R10", severity: "warning",
    title: "diag.R10.title",
    description: "diag.R10.desc",
    steps: ["diag.R10.step.0", "diag.R10.step.1", "diag.R10.step.2", "diag.R10.step.3"],
    condition: s => {
      const p8 = s.ping.find(p => p.target === "8.8.8.8");
      const extDns = s.dns.find(d => d.server === "8.8.8.8");
      const httpFail = s.http.length > 0 && s.http.every(h => !h.statusCode);
      return p8?.status === "ok" && s.tcpConnect?.status === "ok" && extDns?.status === "ok" && httpFail;
    },
  },
  {
    id: "R11", severity: "info",
    title: "diag.R11.title",
    description: "diag.R11.desc",
    steps: ["diag.R11.step.0", "diag.R11.step.1", "diag.R11.step.2"],
    condition: s => {
      const p8 = s.ping.find(p => p.target === "8.8.8.8");
      return p8?.status === "ok" && s.ipv6?.status !== "ok" && s.ipv6 !== null;
    },
  },
  {
    id: "R12", severity: "warning",
    title: "diag.R12.title",
    description: "diag.R12.desc",
    steps: ["diag.R12.step.0", "diag.R12.step.1", "diag.R12.step.2"],
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
