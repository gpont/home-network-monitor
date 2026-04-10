import { db } from "../db/client.ts";
import { ntpChecks, osResolverChecks } from "../db/schema.ts";
import { now } from "./utils.ts";

export function parseResolvConf(content: string): string[] {
  return content
    .split("\n")
    .filter(l => l.trimStart().startsWith("nameserver"))
    .map(l => l.split(/\s+/)[1])
    .filter((s): s is string => Boolean(s));
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
      Bun.udpSocket({
        port: 0,
        socket: {
          data(sock: any, buf: Buffer) {
            clearTimeout(timeout);
            try { resolve(parseNtpResponse(Buffer.from(buf))); } catch { resolve({ status: "fail", driftMs: null }); }
            sock.close();
          },
          error() { clearTimeout(timeout); resolve({ status: "fail", driftMs: null }); },
        },
      }).then((socket) => {
        socket.send(buildNtpPacket(), 123, "pool.ntp.org");
      }).catch(() => {
        clearTimeout(timeout);
        resolve({ status: "fail", driftMs: null });
      });
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
  const timestamp = now();
  const [ntp, resolver] = await Promise.all([checkNtp(), checkOsResolver()]);

  await Promise.all([
    db.insert(ntpChecks).values({ status: ntp.status, driftMs: ntp.driftMs, timestamp }),
    db.insert(osResolverChecks).values({ status: resolver.status, nameservers: JSON.stringify(resolver.nameservers), timestamp }),
  ]);

  return { ntp: { ...ntp, timestamp }, osResolver: { ...resolver, timestamp } };
}
