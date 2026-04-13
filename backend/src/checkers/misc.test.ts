import { describe, test, expect } from "bun:test";
import { detectBlackHole, parseDhcpMacOs, parseNetstatInterfaceStats } from "./misc.ts";

describe("detectBlackHole", () => {
  test("detects 3 consecutive null hops between visible hops", () => {
    const hops = [
      { hop: 1, ip: "192.168.1.1", rttMs: 1.2 },
      { hop: 2, ip: null, rttMs: null },
      { hop: 3, ip: null, rttMs: null },
      { hop: 4, ip: null, rttMs: null },
      { hop: 5, ip: "8.8.8.8", rttMs: 10.2 },
    ];
    expect(detectBlackHole(hops)).toBe(true);
  });
  test("no false positive for 2 consecutive nulls between visible hops", () => {
    const hops = [
      { hop: 1, ip: "192.168.1.1", rttMs: 1 },
      { hop: 2, ip: null, rttMs: null },
      { hop: 3, ip: null, rttMs: null },
      { hop: 4, ip: "8.8.8.8", rttMs: 10 },
    ];
    expect(detectBlackHole(hops)).toBe(false);
  });
  test("no false positive for Docker-style traceroute (1 hop then all nulls)", () => {
    // Docker bridge: only gateway visible, then all nulls — NOT a black hole
    const hops = [
      { hop: 1, ip: "172.17.0.1", rttMs: 0.1 },
      ...Array.from({ length: 19 }, (_, i) => ({ hop: i + 2, ip: null, rttMs: null })),
    ];
    expect(detectBlackHole(hops)).toBe(false);
  });
  test("no false positive for trailing nulls after destination", () => {
    // Common internet behaviour: hops after destination don't respond
    const hops = [
      { hop: 1, ip: "192.168.1.1", rttMs: 1 },
      { hop: 2, ip: "10.0.0.1", rttMs: 5 },
      { hop: 3, ip: "8.8.8.8", rttMs: 15 },
      { hop: 4, ip: null, rttMs: null },
      { hop: 5, ip: null, rttMs: null },
      { hop: 6, ip: null, rttMs: null },
    ];
    expect(detectBlackHole(hops)).toBe(false);
  });
  test("returns false for empty hops", () => {
    expect(detectBlackHole([])).toBe(false);
  });
  test("returns false when only 1 visible hop", () => {
    const hops = [{ hop: 1, ip: "192.168.1.1", rttMs: 1 }];
    expect(detectBlackHole(hops)).toBe(false);
  });
});

describe("parseDhcpMacOs", () => {
  test("parses ipconfig getpacket ACK response", () => {
    const out = `op = BOOTREPLY
htype = 1
options:dhcp_message_type (uint8): ACK 0x5
server_identifier (ip): 192.168.1.1
lease_time (uint32): 0x15180
subnet_mask (ip): 255.255.255.0
router (ip_mult): {192.168.1.1}
end (none): `;
    const result = parseDhcpMacOs(out);
    expect(result.status).toBe("ok");
    expect(result.value).toMatchObject({ connectionType: "dhcp" });
  });

  test("returns unknown for empty output", () => {
    expect(parseDhcpMacOs("").status).toBe("unknown");
  });

  test("detects PPPoE connection", () => {
    const out = `op = BOOTREPLY
htype = 1
options:dhcp_message_type (uint8): DISCOVER 0x1
pppoe_session_id: 0x1234`;
    const result = parseDhcpMacOs(out);
    expect(result.status).toBe("pppoe_up");
    expect(result.value).toMatchObject({ connectionType: "pppoe" });
  });
});

describe("parseNetstatInterfaceStats", () => {
  test("parses netstat -b -I en0 output", () => {
    const out = `Name  Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll
en0  1500  <Link#6>   a4:cf:99:03:aa:bb 7823954     0 7652848826  4682219     0 1893524532     0`;
    const result = parseNetstatInterfaceStats("en0", out);
    expect(result?.interface).toBe("en0");
    expect(result?.rxBytes).toBeGreaterThan(0);
    expect(result?.rxErrors).toBe(0);
    expect(result?.txErrors).toBe(0);
  });

  test("returns null for unknown interface", () => {
    expect(parseNetstatInterfaceStats("eth99", "no data")).toBeNull();
  });
});
