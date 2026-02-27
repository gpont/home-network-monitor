import { db } from "../db/client.ts";
import { publicIpEvents } from "../db/schema.ts";
import { now } from "./utils.ts";
import { desc } from "drizzle-orm";

let lastIpv4: string | null = null;
let lastIpv6: string | null = null;

async function fetchIp(url: string, timeoutMs = 5000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const text = (await res.text()).trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

export async function checkPublicIp() {
  const ts = now();

  const [ipv4, ipv6] = await Promise.all([
    fetchIp("https://api.ipify.org"),
    fetchIp("https://api6.ipify.org"),
  ]);

  const changed =
    (ipv4 !== null && ipv4 !== lastIpv4 && lastIpv4 !== null) ||
    (ipv6 !== null && ipv6 !== lastIpv6 && lastIpv6 !== null);

  if (changed) {
    console.log(`[public-ip] IP changed! ${lastIpv4} → ${ipv4}`);
  }

  // Always save, but mark if changed
  await db.insert(publicIpEvents).values({
    ipv4,
    ipv6,
    changed,
    timestamp: ts,
  });

  lastIpv4 = ipv4 ?? lastIpv4;
  lastIpv6 = ipv6 ?? lastIpv6;

  return { ipv4, ipv6, changed, timestamp: ts };
}

// Restore last known IP from DB on startup
export async function loadLastIp() {
  const last = await db
    .select()
    .from(publicIpEvents)
    .orderBy(desc(publicIpEvents.timestamp))
    .limit(1);

  if (last.length > 0 && last[0]) {
    lastIpv4 = last[0].ipv4;
    lastIpv6 = last[0].ipv6;
  }
}
