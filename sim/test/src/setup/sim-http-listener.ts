/**
 * Loopback HTTP listener for real-mode Playwright sims.
 * Exposes the in-process Hono app on a real port so browser clients hit the wire.
 */

import type { Sim } from '@sim/console/sim/create-sim';

const DEFAULT_PORT = 8787;

export type SimHttpListener = {
  readonly apiUrl: string;
  stop(): Promise<void>;
};

/** Bind sim Hono to `127.0.0.1:<port>` (default 8787). */
export async function listenSimHttpServer(sim: Sim): Promise<SimHttpListener> {
  const hono = await sim.spawnServer();
  const port = Number(process.env['SIM_HTTP_PORT'] ?? DEFAULT_PORT);
  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    fetch(req) {
      return hono.fetch(req);
    },
  });
  const apiUrl = server.url.origin;
  process.env['EXPO_PUBLIC_API_URL'] = apiUrl;
  return {
    apiUrl,
    async stop() {
      server.stop(true);
    },
  };
}
