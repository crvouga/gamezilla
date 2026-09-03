/**
 * Actions whose result is data: they run against live wiring the surface owns
 * and record the outcome in `probes`, where an observation can read it back.
 */

import {
  createAuthClientAdapter,
  createInMemoryAuthClientStorage,
} from '@pkgs/auth/client';
import { draw } from '@pkgs/dst';
import type { SimSqlHandle } from '@sim/console/sim/sim-sql';
import {
  captureSystemSnapshot,
  type SystemSnapshotCtx,
} from '@sim/console/sim/system-snapshot';

import type { ProductSurface } from './surface';
import { defineAction } from './system';

/** Sign in through the client auth port wired to the in-process sim server. */
export const devOauthSignIn = defineAction({
  name: 'devOauthSignIn',
  *generate() {
    const actorId = yield* draw(() => '');
    yield async (s: ProductSurface) => {
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
    };
  },
});

/** Dump server + client SQL / kv / rooms into `probes.snapshot`. */
export const captureSnapshot = defineAction({
  name: 'captureSnapshot',
  *generate() {
    const clientIds = yield* draw(() => [] as string[]);
    yield async (s: ProductSurface) => {
      s.probes.snapshot = await captureSnapshotOf(s, clientIds);
    };
  },
});

async function captureSnapshotOf(
  s: ProductSurface,
  clientIds: readonly string[]
) {
  const sim = s.sim;
  const clientSqlByAddress = new Map<string, SimSqlHandle>();
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
