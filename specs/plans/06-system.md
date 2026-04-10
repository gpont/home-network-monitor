# T06 — system.ts checker

**Зависит от:** T04
**Блокирует:** T11
**Справочники:** [specs/arch.md](../arch.md) §3 New Tables (ntp_checks),
                [specs/design.md](../design.md) §4 Layer 1 — Device/Interface (8 чеков)

---

## Что делаем
Реализуем чекер `system.ts`, который проверяет синхронизацию времени через NTP (UDP-запрос к `pool.ntp.org`, вычисляет дрейф в миллисекундах) и читает `/etc/resolv.conf` для получения списка OS-резолверов. Результаты записываются в таблицы `ntp_checks` и `os_resolver_checks`.

## Файлы
- Create: `backend/src/checkers/system.ts`
- Test: `backend/src/checkers/system.test.ts`

- [ ] Write failing tests:
```ts
// backend/src/checkers/system.test.ts
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
    // NTP epoch: Jan 1 1900. Unix epoch: Jan 1 1970. Diff = 2208988800s
    const NTP_EPOCH_OFFSET = 2208988800;
    const nowSec = Math.floor(Date.now() / 1000) + NTP_EPOCH_OFFSET;
    const buf = Buffer.alloc(48);
    buf.writeUInt32BE(nowSec, 40);   // transmit timestamp seconds
    buf.writeUInt32BE(0, 44);        // transmit timestamp fraction
    const result = parseNtpResponse(buf);
    expect(result.driftMs).toBeLessThan(5000);
    expect(result.status).toBe("ok");
  });
});
```
- [ ] Run: `bun test backend/src/checkers/system.test.ts` — expect FAIL
- [ ] Implement `system.ts`:
```ts
import { db } from "../db/client.ts";
import { ntpChecks, osResolverChecks } from "../db/schema.ts";

export function parseResolvConf(content: string): string[] {
  return content
    .split("\n")
    .filter(l => l.trimStart().startsWith("nameserver"))
    .map(l => l.split(/\s+/)[1])
    .filter(Boolean);
}

export function buildNtpPacket(): Buffer {
  const buf = Buffer.alloc(48);
  buf[0] = 0x23; // LI=0, VN=4, Mode=3 (client)
  return buf;
}

export function parseNtpResponse(buf: Buffer): { status: "ok" | "fail"; driftMs: number } {
  const NTP_EPOCH = 2208988800;
  const ntpSec = buf.readUInt32BE(40);
  const ntpFrac = buf.readUInt32BE(44);
  const ntpMs = (ntpSec - NTP_EPOCH) * 1000 + Math.round(ntpFrac / 4294967.296);
  const driftMs = Math.abs(ntpMs - Date.now());
  return { status: driftMs < 5000 ? "ok" : "fail", driftMs };
}

async function checkNtp(): Promise<{ status: "ok" | "fail"; driftMs: number | null }> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({ status: "fail", driftMs: null }), 5000);
    try {
      const socket = Bun.udpSocket({
        port: 0,
        socket: {
          data(sock, buf) {
            clearTimeout(timeout);
            try { resolve(parseNtpResponse(Buffer.from(buf))); } catch { resolve({ status: "fail", driftMs: null }); }
            sock.close();
          },
          error() { clearTimeout(timeout); resolve({ status: "fail", driftMs: null }); },
        },
      });
      socket.send(buildNtpPacket(), 123, "pool.ntp.org");
    } catch {
      clearTimeout(timeout);
      resolve({ status: "fail", driftMs: null });
    }
  });
}

async function checkOsResolver(): Promise<{ status: "ok" | "fail"; nameservers: string[] }> {
  try {
    const content = await Bun.file("/etc/resolv.conf").text();
    const nameservers = parseResolvConf(content);
    return { status: nameservers.length > 0 ? "ok" : "fail", nameservers };
  } catch {
    return { status: "fail", nameservers: [] };
  }
}

export async function checkSystem() {
  const timestamp = Date.now();
  const [ntp, resolver] = await Promise.all([checkNtp(), checkOsResolver()]);

  await Promise.all([
    db.insert(ntpChecks).values({ status: ntp.status, driftMs: ntp.driftMs, timestamp }),
    db.insert(osResolverChecks).values({ status: resolver.status, nameservers: JSON.stringify(resolver.nameservers), timestamp }),
  ]);

  return { ntp: { ...ntp, timestamp }, osResolver: { ...resolver, timestamp } };
}
```
- [ ] Run: `bun test backend/src/checkers/system.test.ts` — expect PASS
- [ ] Commit:
```bash
git add backend/src/checkers/system.ts backend/src/checkers/system.test.ts
git commit -m "feat: system.ts checker - NTP sync and OS resolver"
```

---

## Мануальная проверка
- [ ] `bun test backend/src/checkers/system.test.ts` — все тесты зелёные
- [ ] Открой `http://localhost:3000/api/status` → поля `ntp`, `resolver` присутствуют
- [ ] Данные выглядят правильно (не null, не undefined)
