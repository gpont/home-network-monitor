import { describe, test, expect } from "bun:test";
import { loadConfig } from "./config.ts";

describe("loadConfig", () => {
  test("uses default ping targets when PING_TARGETS not set", () => {
    delete process.env.PING_TARGETS;
    const config = loadConfig();
    expect(config.pingTargets.some(t => t.host === "8.8.8.8")).toBe(true);
  });

  test("parses PING_TARGETS env var", () => {
    process.env.PING_TARGETS = "1.2.3.4:My Server,5.6.7.8:Other";
    const config = loadConfig();
    expect(config.pingTargets).toContainEqual({ host: "1.2.3.4", label: "My Server" });
    expect(config.pingTargets).toContainEqual({ host: "5.6.7.8", label: "Other" });
    delete process.env.PING_TARGETS;
  });

  test("parses HTTP_TARGETS env var", () => {
    process.env.HTTP_TARGETS = "https://example.com,https://test.com";
    const config = loadConfig();
    expect(config.httpTargets).toEqual(["https://example.com", "https://test.com"]);
    delete process.env.HTTP_TARGETS;
  });

  test("parses DNS_SERVERS env var", () => {
    process.env.DNS_SERVERS = "8.8.4.4:Google2,208.67.222.222:OpenDNS";
    const config = loadConfig();
    expect(config.dnsServers).toContainEqual({ ip: "8.8.4.4", label: "Google2" });
    delete process.env.DNS_SERVERS;
  });
});
