import { describe, test, expect } from "bun:test";
import { parseResolvConf, buildNtpPacket, parseNtpResponse } from "./system.ts";

describe("parseResolvConf", () => {
  test("extracts nameservers", () => {
    const content = "# comment\nnameserver 192.168.1.1\nnameserver 8.8.8.8\n";
    expect(parseResolvConf(content)).toEqual(["192.168.1.1", "8.8.8.8"]);
  });
  test("returns empty array for no nameservers", () => {
    expect(parseResolvConf("# only comments\n")).toEqual([]);
  });
});

describe("parseNtpResponse", () => {
  test("returns drift within tolerance", () => {
    const NTP_EPOCH_OFFSET = 2208988800;
    const nowSec = Math.floor(Date.now() / 1000) + NTP_EPOCH_OFFSET;
    const buf = Buffer.alloc(48);
    buf.writeUInt32BE(nowSec, 40);
    buf.writeUInt32BE(0, 44);
    const result = parseNtpResponse(buf);
    expect(result.driftMs).toBeLessThan(5000);
    expect(result.status).toBe("ok");
  });
});
