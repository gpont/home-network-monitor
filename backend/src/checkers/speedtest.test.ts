import { describe, test, expect } from "bun:test";
import { measurePing, measureDownload, measureUpload } from "./speedtest.ts";

describe("measurePing", () => {
  test("returns a positive latency in ms", async () => {
    const ms = await measurePing(3);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThan(5000);
  });
});

describe("measureDownload", () => {
  test("returns Mbps > 0 for 1 MB download", async () => {
    const mbps = await measureDownload(1_000_000);
    expect(mbps).toBeGreaterThan(0);
  });
});

describe("measureUpload", () => {
  test("returns Mbps > 0 for 500 KB upload", async () => {
    const mbps = await measureUpload(500_000);
    expect(mbps).toBeGreaterThan(0);
  });
});
