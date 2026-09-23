/**
 * Loopback HTTP listener for the bun-webview product host.
 * Exposes the sim load balancer on a real port so browser clients hit the wire
 * and get round-robined across the live API instances.
 * Partition / crash stay on `createSimNet` at the coordinator.
 */

import type { Sim } from '@apps/product/sim/fabric/create-sim';
import { createInProcessOpenAuthSession } from '@pkgs/auth/client';

const DEFAULT_PORT = 8787;
const ACTOR_HEADER = 'x-sim-actor';
/** Caller id for wire requests that carry no actor header. */
const BROWSER_INGRESS_ID = 'browser';

async function completeSimAuthSession(
  sim: Sim,
  req: Request,
  actorId: string
): Promise<Response> {
  const body: unknown = await req.json();
  if (
    body === null ||
    typeof body !== 'object' ||
    !('authorizationUrl' in body) ||
    !('callbackUrl' in body) ||
    typeof body.authorizationUrl !== 'string' ||
    typeof body.callbackUrl !== 'string'
  ) {
    return new Response('invalid auth session request', { status: 400 });
  }
  const complete = createInProcessOpenAuthSession({
    fetch: (input, init) =>
      sim.loadBalancer.fetchFrom(actorId)(new Request(input, init)),
    subject: actorId,
  });
  return Response.json(await complete(body.authorizationUrl, body.callbackUrl));
}

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
  if (err instanceof Error) {
    if (err.name === 'SimPartitionedError' || err.name === 'SimCrashedError') {
      return true;
    }
  }
  return (
    err instanceof TypeError &&
    (err.message.startsWith('sim partition:') ||
      err.message.startsWith('sim crash:'))
  );
}

/** Bind the sim balancer to `localhost:<port>` (default 8787). */
export async function listenSimHttpServer(sim: Sim): Promise<SimHttpListener> {
  await sim.spawnServer();
  const port = Number(process.env['SIM_HTTP_PORT'] ?? DEFAULT_PORT);
  const server = Bun.serve({
    port,
    hostname: 'localhost',
    async fetch(req) {
      const actorId = req.headers.get(ACTOR_HEADER);
      const from =
        actorId != null && actorId !== '' ? actorId : BROWSER_INGRESS_ID;
      try {
        if (
          new URL(req.url).pathname === '/api/__sim/auth-session' &&
          req.method === 'POST'
        ) {
          return await completeSimAuthSession(sim, req, from);
        }
        return await sim.loadBalancer.fetchFrom(from)(req);
      } catch (err) {
        if (isSimNetFault(err)) return partitionedResponse(err);
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
