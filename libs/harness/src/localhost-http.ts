/**
 * Loopback HTTP listener for the bun-webview product host.
 * Exposes the harness load balancer on a real port so browser clients hit the wire
 * and get round-robined across the live API instances.
 * Partition / crash stay on `createHarnessNet` at the coordinator.
 */

import type { Harness } from './create-harness';

const DEFAULT_PORT = 8787;
const ACTOR_HEADER = 'x-harness-actor';
/** Caller id for wire requests that carry no actor header. */
const BROWSER_INGRESS_ID = 'browser';

export type HarnessHttpListener = {
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

function isHarnessNetFault(err: unknown): boolean {
  if (err instanceof Error) {
    if (
      err.name === 'HarnessPartitionedError' ||
      err.name === 'HarnessCrashedError'
    ) {
      return true;
    }
  }
  return (
    err instanceof TypeError &&
    (err.message.startsWith('harness partition:') ||
      err.message.startsWith('harness crash:'))
  );
}

/** Bind the harness balancer to `127.0.0.1:<port>` (default 8787). */
export async function listenHarnessHttpServer(
  harness: Harness
): Promise<HarnessHttpListener> {
  await harness.spawnServer();
  const port = Number(process.env['HARNESS_HTTP_PORT'] ?? DEFAULT_PORT);
  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    async fetch(req) {
      const actorId = req.headers.get(ACTOR_HEADER);
      const from =
        actorId != null && actorId !== '' ? actorId : BROWSER_INGRESS_ID;
      try {
        return await harness.loadBalancer.fetchFrom(from)(req);
      } catch (err) {
        if (isHarnessNetFault(err)) return partitionedResponse(err);
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
