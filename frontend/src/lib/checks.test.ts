import { describe, test, expect } from "bun:test";
import { CHECKS, LAYERS } from "./checks.ts";
import type { StatusResponse } from "./types.ts";

function emptyStatus(): StatusResponse {
  return {
    ping: [], dns: [], http: [], traceroute: null, speedtest: null,
    publicIp: null, cgnat: null, mtu: null, ipv6: null, dhcp: null,
    ssl: [], networkStats: [], interface: null, tcpConnect: null,
    dnsExtra: null, captivePortal: null, httpRedirect: null,
    ntp: null, osResolver: null, pingStats: null,
  };
}

describe("CHECKS", () => {
  test("has exactly 53 checks", () => {
    expect(CHECKS).toHaveLength(53);
  });

  test("all checks have required fields", () => {
    for (const c of CHECKS) {
      expect(c).toHaveProperty("id");
      expect(c).toHaveProperty("layer");
      expect(c).toHaveProperty("name");
      expect(c).toHaveProperty("description");
      expect([1,2,3,4,5,6,7]).toContain(c.layer);
    }
  });

  test("iface_up: ok when interface status is up", () => {
    const s = { ...emptyStatus(), interface: { interfaceName: "eth0", status: "up" as const, ipv4: "192.168.1.5", ipv6LinkLocal: null, gatewayIp: "192.168.1.1", gatewayMac: null, connectionType: "dhcp" as const, rxErrors: 0, txErrors: 0, rxDropped: 0, txDropped: 0, timestamp: Date.now() } };
    const check = CHECKS.find(c => c.id === "iface_up")!;
    expect(check.getStatus(s)).toBe("ok");
  });

  test("iface_up: fail when interface status is down", () => {
    const s = { ...emptyStatus(), interface: { interfaceName: "eth0", status: "down" as const, ipv4: null, ipv6LinkLocal: null, gatewayIp: null, gatewayMac: null, connectionType: "unknown" as const, rxErrors: 0, txErrors: 0, rxDropped: 0, txDropped: 0, timestamp: Date.now() } };
    const check = CHECKS.find(c => c.id === "iface_up")!;
    expect(check.getStatus(s)).toBe("fail");
    expect(check.getFix(s)).not.toBeNull();
  });

  test("iface_up: unknown when no interface data", () => {
    const check = CHECKS.find(c => c.id === "iface_up")!;
    expect(check.getStatus(emptyStatus())).toBe("unknown");
  });

  test("ping_8888: ok when ping to 8.8.8.8 is ok with low RTT", () => {
    const s = { ...emptyStatus(), ping: [{ id: 1, target: "8.8.8.8", targetLabel: "Google", status: "ok" as const, rttMs: 20, timestamp: Date.now() }] };
    const check = CHECKS.find(c => c.id === "ping_8888")!;
    expect(check.getStatus(s)).toBe("ok");
  });

  test("dns_consistency: ok when dnsExtra.consistency is ok", () => {
    const s = { ...emptyStatus(), dnsExtra: { consistency: "ok" as const, nxdomain: "ok" as const, hijacking: "ok" as const, doh: "ok" as const, dnsLeak: "unknown" as const, timestamp: Date.now() } };
    const check = CHECKS.find(c => c.id === "dns_consistency")!;
    expect(check.getStatus(s)).toBe("ok");
  });

  test("ntp: ok when ntp status is ok", () => {
    const s = { ...emptyStatus(), ntp: { status: "ok" as const, driftMs: 100, timestamp: Date.now() } };
    const check = CHECKS.find(c => c.id === "ntp")!;
    expect(check.getStatus(s)).toBe("ok");
  });
});

describe("LAYERS", () => {
  test("has 7 layers", () => {
    expect(LAYERS).toHaveLength(7);
  });
  test("each layer has checks", () => {
    for (const layer of LAYERS) {
      const layerChecks = CHECKS.filter(c => c.layer === layer.id);
      expect(layerChecks.length).toBeGreaterThan(0);
    }
  });
});

describe("remapped info checks", () => {
  test("iface_speed returns ok when networkStats present (not info)", () => {
    const s = { ...emptyStatus(), networkStats: [{ interface: "en0", rxBytes: 1000, txBytes: 500, rxErrors: 0, txErrors: 0, rxDropped: 0, txDropped: 0, timestamp: Date.now() }] };
    expect(CHECKS.find(c => c.id === "iface_speed")!.getStatus(s as any)).toBe("ok");
  });
  test("iface_speed returns unknown when no networkStats", () => {
    expect(CHECKS.find(c => c.id === "iface_speed")!.getStatus(emptyStatus())).toBe("unknown");
  });
  test("iface_ipv6_ll returns warn when no IPv6 LL (not info)", () => {
    const s = { ...emptyStatus(), interface: { interfaceName: "en0", status: "up" as const, ipv4: "192.168.1.5", ipv6LinkLocal: null, gatewayIp: "192.168.1.1", gatewayMac: null, connectionType: "dhcp" as const, rxErrors: 0, txErrors: 0, rxDropped: 0, txDropped: 0, timestamp: Date.now() } };
    expect(CHECKS.find(c => c.id === "iface_ipv6_ll")!.getStatus(s)).toBe("warn");
  });
  test("iface_ipv6_ll returns ok when IPv6 LL present", () => {
    const s = { ...emptyStatus(), interface: { interfaceName: "en0", status: "up" as const, ipv4: "192.168.1.5", ipv6LinkLocal: "fe80::1", gatewayIp: "192.168.1.1", gatewayMac: null, connectionType: "dhcp" as const, rxErrors: 0, txErrors: 0, rxDropped: 0, txDropped: 0, timestamp: Date.now() } };
    expect(CHECKS.find(c => c.id === "iface_ipv6_ll")!.getStatus(s)).toBe("ok");
  });
  test("iface_arp returns warn when no gateway MAC (not info)", () => {
    const s = { ...emptyStatus(), interface: { interfaceName: "en0", status: "up" as const, ipv4: "192.168.1.5", ipv6LinkLocal: null, gatewayIp: "192.168.1.1", gatewayMac: null, connectionType: "dhcp" as const, rxErrors: 0, txErrors: 0, rxDropped: 0, txDropped: 0, timestamp: Date.now() } };
    expect(CHECKS.find(c => c.id === "iface_arp")!.getStatus(s)).toBe("warn");
  });
  test("iface_arp returns ok when gateway MAC present", () => {
    const s = { ...emptyStatus(), interface: { interfaceName: "en0", status: "up" as const, ipv4: "192.168.1.5", ipv6LinkLocal: null, gatewayIp: "192.168.1.1", gatewayMac: "aa:bb:cc:dd:ee:ff", connectionType: "dhcp" as const, rxErrors: 0, txErrors: 0, rxDropped: 0, txDropped: 0, timestamp: Date.now() } };
    expect(CHECKS.find(c => c.id === "iface_arp")!.getStatus(s)).toBe("ok");
  });
  test("wan_type returns ok when connectionType known (not info)", () => {
    const s = { ...emptyStatus(), interface: { interfaceName: "en0", status: "up" as const, ipv4: "192.168.1.5", ipv6LinkLocal: null, gatewayIp: "192.168.1.1", gatewayMac: null, connectionType: "dhcp" as const, rxErrors: 0, txErrors: 0, rxDropped: 0, txDropped: 0, timestamp: Date.now() } };
    expect(CHECKS.find(c => c.id === "wan_type")!.getStatus(s)).toBe("ok");
  });
  test("speedtest returns ok when data present (not info)", () => {
    const s = { ...emptyStatus(), speedtest: { downloadMbps: 100, uploadMbps: 50, latencyMs: 20, timestamp: Date.now() } };
    expect(CHECKS.find(c => c.id === "speedtest")!.getStatus(s as any)).toBe("ok");
  });
});
