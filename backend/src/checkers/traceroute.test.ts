import { describe, test, expect } from "bun:test";
import { parseTracerouteOutput, routingChangedBetween } from "./traceroute.ts";

describe("parseTracerouteOutput", () => {
  test("parses simple single-IP hops", () => {
    const out = `traceroute to 8.8.8.8 (8.8.8.8), 20 hops max, 60 byte packets
 1  192.168.1.1  3.1 ms  2.9 ms  3.0 ms
 2  * * *
 3  212.200.179.9  7.2 ms  5.6 ms  6.1 ms
 4  8.8.8.8  13.3 ms  13.1 ms  13.0 ms`;
    const hops = parseTracerouteOutput(out);
    expect(hops[0]).toEqual({ hop: 1, ip: "192.168.1.1", rttMs: 3.1 });
    expect(hops[1]).toEqual({ hop: 2, ip: null, rttMs: null });
    expect(hops[2]?.ip).toBe("212.200.179.9");
    expect(hops[3]?.ip).toBe("8.8.8.8");
  });

  test("parses ECMP hop — multiple IPs on one line, takes first", () => {
    // traceroute output when ECMP: "3  212.200.179.9  7.2 ms  212.200.179.11  10.0 ms"
    const out = `traceroute to 8.8.8.8 (8.8.8.8), 20 hops max, 60 byte packets
 1  192.168.1.1  3.1 ms  2.9 ms  3.0 ms
 3  212.200.179.9  7.2 ms
    212.200.179.11  10.0 ms
 4  79.101.106.2  13.3 ms
    79.101.96.166  53.6 ms  14.1 ms`;
    const hops = parseTracerouteOutput(out);
    expect(hops[0]?.ip).toBe("192.168.1.1");
    expect(hops[1]?.ip).toBe("212.200.179.9");
  });
});

describe("routingChangedBetween", () => {
  test("returns false when routes are identical", () => {
    const hops = [
      { hop: 1, ip: "192.168.1.1", rttMs: 3 },
      { hop: 2, ip: "212.200.179.9", rttMs: 7 },
      { hop: 3, ip: "8.8.8.8", rttMs: 13 },
    ];
    expect(routingChangedBetween(hops, hops)).toBe(false);
  });

  test("returns false for ECMP variation — same /24 subnets", () => {
    const prev = [
      { hop: 1, ip: "192.168.1.1", rttMs: 3 },
      { hop: 2, ip: "212.200.179.9", rttMs: 7 },   // .9
      { hop: 3, ip: "79.101.106.2", rttMs: 13 },
    ];
    const curr = [
      { hop: 1, ip: "192.168.1.1", rttMs: 3 },
      { hop: 2, ip: "212.200.179.11", rttMs: 10 },  // .11 — same /24
      { hop: 3, ip: "79.101.96.166", rttMs: 14 },   // different /24
    ];
    // hop 2: same /24 (212.200.179.x) → no change
    // hop 3: 79.101.106.x vs 79.101.96.x → different /24, but only 1 out of 3 changed
    // should NOT trigger routingChanged (ECMP tolerance)
    expect(routingChangedBetween(prev, curr)).toBe(false);
  });

  test("returns true when ISP upstream changes completely", () => {
    const prev = [
      { hop: 1, ip: "192.168.1.1", rttMs: 3 },
      { hop: 2, ip: "212.200.179.9", rttMs: 7 },
      { hop: 3, ip: "79.101.106.2", rttMs: 13 },
      { hop: 4, ip: "209.85.250.89", rttMs: 20 },
    ];
    const curr = [
      { hop: 1, ip: "192.168.1.1", rttMs: 3 },
      { hop: 2, ip: "10.0.0.1", rttMs: 7 },         // completely different
      { hop: 3, ip: "195.178.0.1", rttMs: 13 },     // completely different
      { hop: 4, ip: "142.250.0.1", rttMs: 20 },     // completely different
    ];
    expect(routingChangedBetween(prev, curr)).toBe(true);
  });

  test("returns false when previous is empty", () => {
    const curr = [{ hop: 1, ip: "192.168.1.1", rttMs: 3 }];
    expect(routingChangedBetween([], curr)).toBe(false);
  });
});
