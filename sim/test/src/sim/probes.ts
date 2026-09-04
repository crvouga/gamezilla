/**
 * Actions whose result is data: they run against live wiring the surface owns
 * and record the outcome in `probes`, where a read can observe it back.
 */

import {
  createAuthClientAdapter,
  createInMemoryAuthClientStorage,
} from '@pkgs/auth/client';
import type { SimSql } from '@sim/console/sim/sim-sql';
import {
  captureSystemSnapshot,
  type SystemSnapshotCtx,
} from '@sim/console/sim/system-snapshot';

import type { ProductSim } from './sim';
import { product } from './system';

/** Sign in through the client auth port wired to the in-process sim server. */
export const devOauthSignIn = product.action({
  name: 'devOauthSignIn',
  act: async (s, actorId: string) => {
    const env = s.sim.client(actorId);
    const port = createAuthClientAdapter({
      baseURL: env.authBaseURL,
      timers: env.timers,
      fetch: env.server,
      storage: createInMemoryAuthClientStorage(),
      openAuthSession: env.openAuthSession,
      callbackUrl: 'gamezilla://sso-callback',
    });
    await port.signIn('oauth-dev');
    const token = await port.getFreshToken();
    s.probes.oauthTokenLength = token === null ? null : token.length;
  },
});

/** Dump server + client SQL / kv / rooms into `probes.snapshot`. */
export const captureSnapshot = product.action({
  name: 'captureSnapshot',
  act: async (s, clientIds: readonly string[]) => {
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
