import { describe, test, expect } from "bun:test";
import { detectBlackHole } from "./misc.ts";

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
