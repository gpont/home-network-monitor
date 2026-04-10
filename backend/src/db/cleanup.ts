import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { lt } from "drizzle-orm";
import {
  pingResults,
  dnsResults,
  httpResults,
  captivePortalChecks,
  httpRedirectChecks,
  tracerouteResults,
  miscChecks,
  interfaceChecks,
  tcpConnectResults,
  dnsExtraChecks,
  ntpChecks,
  osResolverChecks,
  speedtestResults,
  publicIpEvents,
  sslChecks,
  networkStats,
} from "./schema.ts";

const MS = {
  h48: 48 * 60 * 60 * 1000,
  d30: 30 * 24 * 60 * 60 * 1000,
  d90: 90 * 24 * 60 * 60 * 1000,
};

export async function runCleanup(db: BunSQLiteDatabase<any>) {
  const now = Date.now();
  const cuts = {
    h48: now - MS.h48,
    d30: now - MS.d30,
    d90: now - MS.d90,
  };

  await Promise.all([
    db.delete(pingResults).where(lt(pingResults.timestamp, cuts.h48)),
    db.delete(dnsResults).where(lt(dnsResults.timestamp, cuts.h48)),
    db.delete(httpResults).where(lt(httpResults.timestamp, cuts.h48)),
    db.delete(captivePortalChecks).where(lt(captivePortalChecks.timestamp, cuts.h48)),
    db.delete(httpRedirectChecks).where(lt(httpRedirectChecks.timestamp, cuts.h48)),
    db.delete(tracerouteResults).where(lt(tracerouteResults.timestamp, cuts.d30)),
    db.delete(miscChecks).where(lt(miscChecks.timestamp, cuts.d30)),
    db.delete(interfaceChecks).where(lt(interfaceChecks.timestamp, cuts.d30)),
    db.delete(tcpConnectResults).where(lt(tcpConnectResults.timestamp, cuts.d30)),
    db.delete(dnsExtraChecks).where(lt(dnsExtraChecks.timestamp, cuts.d30)),
    db.delete(ntpChecks).where(lt(ntpChecks.timestamp, cuts.d30)),
    db.delete(osResolverChecks).where(lt(osResolverChecks.timestamp, cuts.d30)),
    db.delete(speedtestResults).where(lt(speedtestResults.timestamp, cuts.d90)),
    db.delete(publicIpEvents).where(lt(publicIpEvents.timestamp, cuts.d90)),
    db.delete(sslChecks).where(lt(sslChecks.timestamp, cuts.d90)),
    db.delete(networkStats).where(lt(networkStats.timestamp, cuts.d90)),
  ]);
}

export function scheduleCleanup(db: BunSQLiteDatabase<any>) {
  runCleanup(db).catch(console.error);
  setInterval(() => runCleanup(db).catch(console.error), 24 * 60 * 60 * 1000);
}
