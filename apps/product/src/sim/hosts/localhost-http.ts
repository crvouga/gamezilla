/**
 * Loopback HTTP listener for the bun-webview product host.
 * Exposes the in-process Hono app on a real port so browser clients hit the wire.
 * Partition / crash stay on `createSimNet` at the coordinator.
 */

import type { Sim } from '@apps/product/sim/fabric/create-sim';
import { simCrashedError } from '@apps/product/sim/fabric/sim-net';

const DEFAULT_PORT = 8787;
const ACTOR_HEADER = 'x-sim-actor';

export type SimHttpListener = {
  readonly apiUrl: string;
  stop(): Promise<void>;
};

function partitionedResponse(err: unknown): Response {
  const message = err instanceof Error ? err.message : String(err);
  return new Response(message, {
    status: 503,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

function isSimNetFault(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === 'SimPartitionedError' || err.name === 'SimCrashedError';
}

/** Bind sim Hono to `127.0.0.1:<port>` (default 8787), gated by createSimNet. */
export async function listenSimHttpServer(sim: Sim): Promise<SimHttpListener> {
  const hono = await sim.spawnServer();
  const port = Number(process.env['SIM_HTTP_PORT'] ?? DEFAULT_PORT);
  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    fetch(req) {
      try {
        if (sim.net.isCrashed('server')) {
          throw simCrashedError('server');
        }
        const actorId = req.headers.get(ACTOR_HEADER);
        if (actorId != null && actorId !== '') {
          sim.net.assertReachable(actorId, 'server');
        }
        return hono.fetch(req);
      } catch (err) {
        if (isSimNetFault(err)) return partitionedResponse(err);
        if (
          err instanceof TypeError &&
          (err.message.startsWith('sim partition:') ||
            err.message.startsWith('sim crash:'))
        ) {
          return partitionedResponse(err);
        }
        throw err;
      }
    },
  });
  const apiUrl = server.url.origin;
  process.env['VITE_API_URL'] = apiUrl;
  return {
    apiUrl,
    stop: () => server.stop(true),
  };
}

export { ACTOR_HEADER };
