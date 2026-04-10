import { describe, test, expect } from "bun:test";
import { parseIpLinkOutput, parseIpAddrOutput, parseIpRouteOutput, parseArpOutput } from "./interface.ts";

describe("parseIpLinkOutput", () => {
  test("detects interface UP", () => {
    const out = "2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP";
    expect(parseIpLinkOutput(out)).toEqual({ name: "eth0", status: "up" });
  });
  test("detects interface DOWN", () => {
    const out = "2: eth0: <BROADCAST,MULTICAST> mtu 1500 qdisc noop state DOWN";
    expect(parseIpLinkOutput(out)).toEqual({ name: "eth0", status: "down" });
  });
});

describe("parseIpAddrOutput", () => {
  test("extracts IPv4 address", () => {
    const out = "    inet 192.168.1.5/24 brd 192.168.1.255 scope global eth0";
    expect(parseIpAddrOutput(out).ipv4).toBe("192.168.1.5");
  });
  test("extracts IPv6 link-local", () => {
    const out = "    inet6 fe80::1a2b:3c4d:5e6f:7a8b/64 scope link";
    expect(parseIpAddrOutput(out).ipv6LinkLocal).toBe("fe80::1a2b:3c4d:5e6f:7a8b");
  });
});

describe("parseIpRouteOutput", () => {
  test("extracts default gateway", () => {
    const out = "default via 192.168.1.1 dev eth0 proto dhcp";
    expect(parseIpRouteOutput(out)).toEqual({ gatewayIp: "192.168.1.1", connectionType: "dhcp" });
  });
  test("detects PPPoE", () => {
    const out = "default via 10.0.0.1 dev ppp0 proto kernel";
    expect(parseIpRouteOutput(out).connectionType).toBe("pppoe");
  });
});

describe("parseArpOutput", () => {
  test("extracts MAC for known IP", () => {
    const out = "192.168.1.1 ether aa:bb:cc:dd:ee:ff C eth0";
    expect(parseArpOutput("192.168.1.1", out)).toBe("aa:bb:cc:dd:ee:ff");
  });
  test("returns null when IP not in table", () => {
    const out = "192.168.1.2 ether aa:bb:cc:dd:ee:ff C eth0";
    expect(parseArpOutput("192.168.1.1", out)).toBeNull();
  });
});
