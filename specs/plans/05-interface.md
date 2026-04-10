# T05 — interface.ts checker

**Зависит от:** T04
**Блокирует:** T11
**Справочники:** [specs/arch.md](../arch.md) §3 New Tables (interface_checks),
                [specs/design.md](../design.md) §4 Layer 1 — Device/Interface (8 чеков)

---

## Что делаем
Реализуем чекер `interface.ts`, который собирает статус сетевого интерфейса: имя, состояние (up/down), IPv4/IPv6-адреса, шлюз по умолчанию, MAC-адрес шлюза, тип подключения (DHCP/PPPoE/static), счётчики ошибок и дропов из `/proc/net/dev`. Данные получаем через `ip link`, `ip addr`, `ip route`, `arp -n` и записываем в таблицу `interface_checks`.

## Файлы
- Create: `backend/src/checkers/interface.ts`
- Test: `backend/src/checkers/interface.test.ts`

- [ ] Write failing tests:
```ts
// backend/src/checkers/interface.test.ts
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
```
- [ ] Run: `bun test backend/src/checkers/interface.test.ts` — expect FAIL
- [ ] Implement `interface.ts`:
```ts
import { db } from "../db/client.ts";
import { interfaceChecks } from "../db/schema.ts";
import { spawn } from "./utils.ts";

export function parseIpLinkOutput(out: string): { name: string; status: "up" | "down" | "unknown" } {
  const m = out.match(/\d+:\s+(\S+):.*state\s+(UP|DOWN)/i);
  if (!m) return { name: "unknown", status: "unknown" };
  return { name: m[1].replace(/@.*/, ""), status: m[2].toUpperCase() === "UP" ? "up" : "down" };
}

export function parseIpAddrOutput(out: string): { ipv4: string | null; ipv6LinkLocal: string | null } {
  const v4 = out.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
  const v6 = out.match(/inet6\s+(fe80:[^\s/]+)/i);
  return { ipv4: v4?.[1] ?? null, ipv6LinkLocal: v6?.[1] ?? null };
}

export function parseIpRouteOutput(out: string): { gatewayIp: string | null; connectionType: "dhcp" | "pppoe" | "static" | "unknown" } {
  const m = out.match(/default via (\S+)/);
  if (!m) return { gatewayIp: null, connectionType: "unknown" };
  const pppoe = /ppp\d/.test(out);
  const dhcp = /dhcp/.test(out);
  return {
    gatewayIp: m[1],
    connectionType: pppoe ? "pppoe" : dhcp ? "dhcp" : "static",
  };
}

export function parseArpOutput(ip: string, out: string): string | null {
  const escaped = ip.replace(/\./g, "\\.");
  const m = out.match(new RegExp(`${escaped}\\s+ether\\s+([\\da-f:]+)`, "i"));
  return m?.[1] ?? null;
}

export async function checkInterface() {
  const timestamp = Date.now();
  try {
    const [linkOut, addrOut, routeOut] = await Promise.all([
      spawn(["ip", "link", "show"], 3000),
      spawn(["ip", "addr", "show"], 3000),
      spawn(["ip", "route", "show", "default"], 3000),
    ]);

    const link = parseIpLinkOutput(linkOut);
    const addr = parseIpAddrOutput(addrOut);
    const route = parseIpRouteOutput(routeOut);

    let gatewayMac: string | null = null;
    if (route.gatewayIp) {
      const arpOut = await spawn(["arp", "-n", route.gatewayIp], 2000).catch(() => "");
      gatewayMac = parseArpOutput(route.gatewayIp, arpOut);
    }

    // Read /proc/net/dev for errors/drops
    let rxErrors = 0, txErrors = 0, rxDropped = 0, txDropped = 0;
    try {
      const procOut = await Bun.file("/proc/net/dev").text();
      const line = procOut.split("\n").find(l => l.includes(link.name));
      if (line) {
        const parts = line.trim().split(/\s+/);
        // Format: iface: rxBytes rxPkts rxErrors rxDrop ... txBytes txPkts txErrors txDrop ...
        rxErrors = parseInt(parts[3] ?? "0");
        rxDropped = parseInt(parts[4] ?? "0");
        txErrors = parseInt(parts[11] ?? "0");
        txDropped = parseInt(parts[12] ?? "0");
      }
    } catch { /* not on Linux */ }

    const result = {
      interfaceName: link.name,
      status: link.status,
      ipv4: addr.ipv4,
      ipv6LinkLocal: addr.ipv6LinkLocal,
      gatewayIp: route.gatewayIp,
      gatewayMac,
      connectionType: route.connectionType,
      rxErrors, txErrors, rxDropped, txDropped,
      timestamp,
    };

    await db.insert(interfaceChecks).values(result);
    return result;
  } catch (e) {
    const result = {
      interfaceName: "unknown", status: "unknown" as const,
      ipv4: null, ipv6LinkLocal: null, gatewayIp: null, gatewayMac: null,
      connectionType: "unknown" as const,
      rxErrors: 0, txErrors: 0, rxDropped: 0, txDropped: 0,
      timestamp,
    };
    await db.insert(interfaceChecks).values(result);
    return result;
  }
}
```
- [ ] Run: `bun test backend/src/checkers/interface.test.ts` — expect PASS
- [ ] Commit:
```bash
git add backend/src/checkers/interface.ts backend/src/checkers/interface.test.ts
git commit -m "feat: interface.ts checker - network interface status"
```

---

## Мануальная проверка
- [ ] `bun test backend/src/checkers/interface.test.ts` — все тесты зелёные
- [ ] Открой `http://localhost:3000/api/status` → поле `interface` присутствует
- [ ] Данные выглядят правильно (не null, не undefined)
