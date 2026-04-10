import { describe, test, expect } from "bun:test";
import { detectBlackHole, parseDhcpMacOs, parseNetstatInterfaceStats } from "./misc.ts";

describe("detectBlackHole", () => {
  test("detects 3 consecutive null hops", () => {
    const hops = [
      { hop: 1, ip: "192.168.1.1", rttMs: 1.2 },
      { hop: 2, ip: null, rttMs: null },
      { hop: 3, ip: null, rttMs: null },
      { hop: 4, ip: null, rttMs: null },
      { hop: 5, ip: "8.8.8.8", rttMs: 10.2 },
    ];
    expect(detectBlackHole(hops)).toBe(true);
  });
  test("no false positive for 2 consecutive nulls", () => {
    const hops = [
      { hop: 1, ip: "192.168.1.1", rttMs: 1 },
      { hop: 2, ip: null, rttMs: null },
      { hop: 3, ip: null, rttMs: null },
      { hop: 4, ip: "8.8.8.8", rttMs: 10 },
    ];
    expect(detectBlackHole(hops)).toBe(false);
  });
  test("returns false for empty hops", () => {
    expect(detectBlackHole([])).toBe(false);
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
