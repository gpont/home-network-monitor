import { describe, test, expect } from "bun:test";
import { parseIpLinkOutput, parseIpAddrOutput, parseIpRouteOutput, parseArpOutput, parseIfconfigOutput, parseNetstatRouteOutput, parseNetstatIfaceStats } from "./interface.ts";

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
  test("extracts default gateway and interface", () => {
    const out = "default via 192.168.1.1 dev eth0 proto dhcp";
    expect(parseIpRouteOutput(out)).toEqual({ gatewayIp: "192.168.1.1", iface: "eth0", connectionType: "dhcp" });
  });
  test("detects PPPoE", () => {
    const out = "default via 10.0.0.1 dev ppp0 proto kernel";
    expect(parseIpRouteOutput(out).connectionType).toBe("pppoe");
  });
  test("returns null iface when no dev field", () => {
    const out = "default via 192.168.1.1";
    expect(parseIpRouteOutput(out).iface).toBeNull();
  });
});

describe("parseArpOutput", () => {
  test("extracts MAC for known IP (Linux format)", () => {
    const out = "192.168.1.1 ether aa:bb:cc:dd:ee:ff C eth0";
    expect(parseArpOutput("192.168.1.1", out)).toBe("aa:bb:cc:dd:ee:ff");
  });
  test("extracts MAC for known IP (macOS format)", () => {
    const out = "? (192.168.1.1) at 9c:73:70:2a:e5:7f on en0 ifscope [ethernet]";
    expect(parseArpOutput("192.168.1.1", out)).toBe("9c:73:70:2a:e5:7f");
  });
  test("returns null when IP not in table", () => {
    const out = "192.168.1.2 ether aa:bb:cc:dd:ee:ff C eth0";
    expect(parseArpOutput("192.168.1.1", out)).toBeNull();
  });
});

describe("parseIfconfigOutput (macOS)", () => {
  test("detects UP interface with IPv4 and IPv6 LL", () => {
    const out = `en0: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500
\toptions=400<CHANNEL_IO>
\tether a4:cf:99:03:aa:bb
\tinet6 fe80::1a2b:3c4d:5e6f:7a8b%en0 prefixlen 64 secured scopeid 0x6
\tinet 192.168.1.5 netmask 0xffffff00 broadcast 192.168.1.255
\tnd6 options=201<PERFORMNUD,DAD>
\tmedia: autoselect (1000baseT <full-duplex>)
\tstatus: active`;
    const result = parseIfconfigOutput(out);
    expect(result.name).toBe("en0");
    expect(result.status).toBe("up");
    expect(result.ipv4).toBe("192.168.1.5");
    expect(result.ipv6LinkLocal).toBe("fe80::1a2b:3c4d:5e6f:7a8b");
  });

  test("detects DOWN interface", () => {
    const out = `en1: flags=8822<BROADCAST,SMART,SIMPLEX,MULTICAST> mtu 1500
\tstatus: inactive`;
    const result = parseIfconfigOutput(out);
    expect(result.status).toBe("down");
  });

  test("returns unknown for empty output", () => {
    expect(parseIfconfigOutput("").status).toBe("unknown");
  });

  test("skips loopback lo0 and returns physical interface", () => {
    const out = `lo0: flags=8049<UP,LOOPBACK,RUNNING> mtu 16384
\tinet 127.0.0.1 netmask 0xff000000
en0: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500
\tinet 192.168.1.5 netmask 0xffffff00 broadcast 192.168.1.255`;
    const result = parseIfconfigOutput(out);
    expect(result.name).toBe("en0");
    expect(result.ipv4).toBe("192.168.1.5");
  });

  test("skips inactive en interfaces without inet and finds active en0", () => {
    const out = `en4: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500
\tether 7a:64:40:3d:02:43
\tstatus: inactive
en5: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500
\tether 7a:64:40:3d:02:44
\tstatus: inactive
en0: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500
\tether 36:82:41:2e:cc:07
\tinet6 fe80::1805:bf2e:9f4f:3eed%en0 prefixlen 64 secured scopeid 0xf
\tinet 192.168.1.254 netmask 0xffffff00 broadcast 192.168.1.255
\tstatus: active`;
    const result = parseIfconfigOutput(out);
    expect(result.name).toBe("en0");
    expect(result.ipv4).toBe("192.168.1.254");
    expect(result.ipv6LinkLocal).toBe("fe80::1805:bf2e:9f4f:3eed");
  });
});

describe("parseNetstatRouteOutput (macOS)", () => {
  test("extracts default gateway", () => {
    const out = `Routing tables

Internet:
Destination        Gateway            Flags               Netif Expire
default            192.168.1.1        UGScg               en0`;
    expect(parseNetstatRouteOutput(out)).toEqual({
      gatewayIp: "192.168.1.1",
      connectionType: "dhcp",
    });
  });

  test("returns null gateway for empty table", () => {
    expect(parseNetstatRouteOutput("no routes").gatewayIp).toBeNull();
  });
});

describe("parseNetstatIfaceStats (macOS)", () => {
  test("parses netstat -I en0 -b output", () => {
    const out = `Name  Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll
en0  1500  <Link#6>   a4:cf:99:03:aa:bb 7823954     3 7652848826  4682219     1 1893524532     0`;
    const result = parseNetstatIfaceStats("en0", out);
    expect(result.rxErrors).toBe(3);
    expect(result.txErrors).toBe(1);
    expect(result.rxDropped).toBe(0);
    expect(result.txDropped).toBe(0);
  });

  test("returns zeros for unknown interface", () => {
    const result = parseNetstatIfaceStats("eth99", "no data");
    expect(result.rxErrors).toBe(0);
    expect(result.txErrors).toBe(0);
  });
});
