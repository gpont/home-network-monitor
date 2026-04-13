import { describe, test, expect } from "bun:test";
import { checkDnsConsistency, checkNxdomain, checkHijacking } from "./dns.ts";

describe("checkDnsConsistency", () => {
  test("ok when all resolvers return same answer", () => {
    const results = [
      { status: "ok" as const, answer: "1.1.1.1" },
      { status: "ok" as const, answer: "1.1.1.1" },
      { status: "ok" as const, answer: "1.1.1.1" },
    ];
    expect(checkDnsConsistency(results)).toBe("ok");
  });
  test("mismatch when answers differ (no validAnswers set)", () => {
    const results = [
      { status: "ok" as const, answer: "1.1.1.1" },
      { status: "ok" as const, answer: "2.2.2.2" },
    ];
    expect(checkDnsConsistency(results)).toBe("mismatch");
  });
  test("unknown when no ok results", () => {
    const results = [
      { status: "timeout" as const, answer: null },
    ];
    expect(checkDnsConsistency(results)).toBe("unknown");
  });
  test("ok when answers differ but all within validAnswers (anycast)", () => {
    const valid = new Set(["1.1.1.1", "1.0.0.1"]);
    const results = [
      { status: "ok" as const, answer: "1.1.1.1" },
      { status: "ok" as const, answer: "1.0.0.1" },
      { status: "ok" as const, answer: "1.1.1.1" },
    ];
    expect(checkDnsConsistency(results, valid)).toBe("ok");
  });
  test("mismatch when one answer is outside validAnswers (hijacked)", () => {
    const valid = new Set(["1.1.1.1", "1.0.0.1"]);
    const results = [
      { status: "ok" as const, answer: "203.0.113.1" }, // hijacked router answer
      { status: "ok" as const, answer: "1.1.1.1" },
    ];
    expect(checkDnsConsistency(results, valid)).toBe("mismatch");
  });
});

describe("checkNxdomain", () => {
  test("ok when output contains NXDOMAIN", () => {
    expect(checkNxdomain("status: NXDOMAIN")).toBe("ok");
  });
  test("fail when output does not contain NXDOMAIN", () => {
    expect(checkNxdomain("status: NOERROR")).toBe("fail");
  });
});

describe("checkHijacking", () => {
  test("ok when answer is 1.1.1.1", () => {
    expect(checkHijacking("1.1.1.1")).toBe("ok");
  });
  test("ok when answer is 1.0.0.1 (also valid Cloudflare IP for one.one.one.one)", () => {
    expect(checkHijacking("1.0.0.1")).toBe("ok");
  });
  test("hijacked when answer is different", () => {
    expect(checkHijacking("8.8.8.8")).toBe("hijacked");
  });
  test("unknown when no answer", () => {
    expect(checkHijacking(null)).toBe("unknown");
  });
});
