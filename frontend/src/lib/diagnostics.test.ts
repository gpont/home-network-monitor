import { describe, test, expect } from "bun:test";
import { evaluate } from "./diagnostics.ts";
import type { StatusResponse } from "./types.ts";

function baseStatus(): StatusResponse {
  return {
    ping: [
      { id: 1, target: "192.168.1.1", targetLabel: "Router", status: "ok", rttMs: 1.2, timestamp: Date.now() },
      { id: 2, target: "8.8.8.8", targetLabel: "Google", status: "ok", rttMs: 20, timestamp: Date.now() },
      { id: 3, target: "1.1.1.1", targetLabel: "Cloudflare", status: "ok", rttMs: 18, timestamp: Date.now() },
    ],
    dns: [
      { id: 1, server: "192.168.1.1", serverLabel: "Router", domain: "one.one.one.one", status: "ok", latencyMs: 8, timestamp: Date.now() },
      { id: 2, server: "8.8.8.8", serverLabel: "Google", domain: "one.one.one.one", status: "ok", latencyMs: 20, timestamp: Date.now() },
    ],
    http: [
      { id: 1, url: "https://www.google.com", statusCode: 200, latencyMs: 300, error: null, timestamp: Date.now() },
      { id: 2, url: "https://www.cloudflare.com", statusCode: 200, latencyMs: 200, error: null, timestamp: Date.now() },
    ],
    traceroute: null, speedtest: null, publicIp: null,
    cgnat: { id: 1, type: "cgnat" as const, status: "direct", value: null, timestamp: Date.now() },
    mtu: null, ipv6: null, dhcp: null, ssl: [], networkStats: [],
    interface: { interfaceName: "eth0", status: "up", ipv4: "192.168.1.5", ipv6LinkLocal: "fe80::1", gatewayIp: "192.168.1.1", gatewayMac: "aa:bb:cc:dd:ee:ff", connectionType: "dhcp", rxErrors: 0, txErrors: 0, rxDropped: 0, txDropped: 0, timestamp: Date.now() },
    tcpConnect: { host: "1.1.1.1", port: 443, status: "ok", latencyMs: 18, timestamp: Date.now() },
    dnsExtra: { consistency: "ok", nxdomain: "ok", hijacking: "ok", doh: "ok", dnsLeak: "unknown", timestamp: Date.now() },
    captivePortal: { status: "clean", timestamp: Date.now() },
    httpRedirect: { status: "ok", timestamp: Date.now() },
    ntp: { status: "ok", driftMs: 30, timestamp: Date.now() },
    osResolver: { status: "ok", nameservers: ["192.168.1.1"], timestamp: Date.now() },
    pingStats: { targets: { "8.8.8.8": { lossPercent: 0, jitterMs: 1.2, avgRttMs: 20 }, "1.1.1.1": { lossPercent: 0, jitterMs: 1.0, avgRttMs: 18 } } },
  };
}

describe("evaluate — healthy system", () => {
  test("returns empty array when all checks pass", () => {
    expect(evaluate(baseStatus())).toHaveLength(0);
  });
});

describe("R3: ISP outage (no_internet)", () => {
  test("fires when gateway ok but 8.8.8.8 and 1.1.1.1 timeout", () => {
    const s = { ...baseStatus(), ping: [
      { id: 1, target: "192.168.1.1", targetLabel: "Router", status: "ok" as const, rttMs: 1.2, timestamp: Date.now() },
      { id: 2, target: "8.8.8.8", targetLabel: "Google", status: "timeout" as const, rttMs: null, timestamp: Date.now() },
      { id: 3, target: "1.1.1.1", targetLabel: "CF", status: "timeout" as const, rttMs: null, timestamp: Date.now() },
    ]};
    expect(evaluate(s).find(r => r.id === "R3")).toBeDefined();
  });
  test("does NOT fire when gateway also fails", () => {
    const s = { ...baseStatus(), ping: [
      { id: 1, target: "192.168.1.1", targetLabel: "Router", status: "timeout" as const, rttMs: null, timestamp: Date.now() },
      { id: 2, target: "8.8.8.8", targetLabel: "Google", status: "timeout" as const, rttMs: null, timestamp: Date.now() },
    ]};
    expect(evaluate(s).find(r => r.id === "R3")).toBeUndefined();
  });
});

describe("R7: packet_loss", () => {
  test("fires when loss > 5%", () => {
    const s = { ...baseStatus(), pingStats: { targets: { "8.8.8.8": { lossPercent: 8.5, jitterMs: 5, avgRttMs: 25 } } } };
    expect(evaluate(s).find(r => r.id === "R7")).toBeDefined();
  });
  test("does not fire when loss < 5%", () => {
    const s = { ...baseStatus(), pingStats: { targets: { "8.8.8.8": { lossPercent: 2, jitterMs: 1, avgRttMs: 20 } } } };
    expect(evaluate(s).find(r => r.id === "R7")).toBeUndefined();
  });
});

describe("R9: cgnat_detected", () => {
  test("fires when CGNAT detected", () => {
    const s = { ...baseStatus(), cgnat: { id: 1, type: "cgnat" as const, status: "cgnat", value: null, timestamp: Date.now() } };
    expect(evaluate(s).find(r => r.id === "R9")).toBeDefined();
  });
  test("does not fire when direct", () => {
    expect(evaluate(baseStatus()).find(r => r.id === "R9")).toBeUndefined();
  });
});

describe("R6: dns_hijacking", () => {
  test("fires when hijacking detected", () => {
    const s = { ...baseStatus(), dnsExtra: { ...baseStatus().dnsExtra!, hijacking: "hijacked" as const } };
    expect(evaluate(s).find(r => r.id === "R6")).toBeDefined();
  });
});
