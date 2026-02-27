declare module "speedtest-net" {
  interface SpeedtestOptions {
    acceptLicense?: boolean;
    acceptGdpr?: boolean;
    serverId?: number;
  }

  interface SpeedtestResult {
    download: { bandwidth: number };
    upload: { bandwidth: number };
    ping: { latency: number; jitter: number };
    server?: { name: string; location: string; country: string; host: string };
    result?: { url: string };
  }

  function speedtest(options?: SpeedtestOptions): Promise<SpeedtestResult>;
  export = speedtest;
}
