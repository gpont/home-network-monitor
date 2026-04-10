import { describe, test, expect } from "bun:test";
import { checkTcpConnect, computePingStats } from "./ping.ts";

describe("checkTcpConnect", () => {
  test("returns result object with status field", async () => {
    const result = await checkTcpConnect("1.1.1.1", 443);
    expect(result).toHaveProperty("status");
    expect(["ok", "timeout", "error"]).toContain(result.status);
  });
});

describe("computePingStats", () => {
  test("returns stats object structure", () => {
    const rows = [
      { target: "8.8.8.8", rttMs: 10, status: "ok" as const },
      { target: "8.8.8.8", rttMs: 20, status: "ok" as const },
      { target: "8.8.8.8", rttMs: null, status: "timeout" as const },
    ];
    const stats = computePingStats(rows);
    expect(stats["8.8.8.8"]).toBeDefined();
    expect(stats["8.8.8.8"]!.lossPercent).toBeCloseTo(33.33, 0);
    expect(stats["8.8.8.8"]!.avgRttMs).toBeCloseTo(15, 0);
    expect(typeof stats["8.8.8.8"]!.jitterMs).toBe("number");
  });
});
