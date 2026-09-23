/**
 * Actions whose result is data: they run against live wiring the surface owns
 * and record the outcome in `probes`, where a read can observe it back.
 */

import type { SimSql } from '@apps/product/sim/fabric/sim-sql';
import {
  captureSystemSnapshot,
  type SystemSnapshotCtx,
} from '@apps/product/sim/fabric/system-snapshot';
import {
  createAuthClientAdapter,
  createInMemoryAuthClientStorage,
  createInProcessOpenAuthSession,
} from '@pkgs/auth/client';
import { defineAction } from '@pkgs/sim';

import { type ProductSim, productExtra } from './sim';

/**
 * Sign in through the client auth port: against the sim server, or against
 * the real API Worker on the full stack (Dev IdP completed by the harness).
 */
export const devOauthSignIn = defineAction({
  name: 'devOauthSignIn',
  pool: false,
  act: async (s: ProductSim, actorId: string) => {
    const env = s.sim.client(actorId);
    const http = productExtra(s).http;
    const port = createAuthClientAdapter({
      timers: env.timers,
      storage: createInMemoryAuthClientStorage(),
      callbackUrl: 'gamezilla://sso-callback',
      ...(http.kind === 'full-stack'
        ? {
            baseURL: http.origin,
            fetch: http.fetch,
            openAuthSession: createInProcessOpenAuthSession({
              fetch: http.fetch,
              subject: actorId,
            }),
          }
        : {
            baseURL: env.authBaseURL,
            fetch: env.server,
            openAuthSession: env.openAuthSession,
          }),
    });
    await port.signIn('oauth-dev');
    const token = await port.getFreshToken();
    s.probes.oauthTokenLength = token === null ? null : token.length;
  },
});

/** Dump server + client SQL / kv / rooms into `probes.snapshot`. */
export const captureSnapshot = defineAction({
  name: 'captureSnapshot',
  pool: false,
  act: async (s: ProductSim, clientIds: readonly string[]) => {
    s.probes.snapshot = await captureSnapshotOf(s, clientIds);
  },
});

async function captureSnapshotOf(s: ProductSim, clientIds: readonly string[]) {
  const sim = s.sim;
  const clientSqlByAddress = new Map<string, SimSql>();
  const liveClients = new Map<string, ReturnType<typeof sim.spawnClient>>();
  for (const id of clientIds) {
    liveClients.set(id, sim.spawnClient(id));
    const handle = sim.clientSql(id);
    if (handle !== undefined) {
      clientSqlByAddress.set(id, handle);
    }
  }
  const ctx: SystemSnapshotCtx = {
    sim,
    clientIds,
    liveClients,
    clientSqlByAddress,
  };
  return captureSystemSnapshot(ctx);
}
