/**
 * Actions whose result is data: they run against live wiring the surface owns
 * and record the outcome in `probes`, where a read can observe it back.
 */

import type { Client } from '@libs/client-app/shell/create-client';
import {
  createInhouseAuthClient,
  createInMemoryAuthClientStorage,
} from '@pkgs/auth-inhouse/client';
import { defineAction } from '@pkgs/sim';
import type { SimSql } from '../fabric/sim-sql';
import {
  captureSystemSnapshot,
  type SystemSnapshotCtx,
} from '../fabric/system-snapshot';

import { actorUi, pollUntil } from './actor-ui';
import { actorEmail } from './identity';
import { completeProviderSignIn } from './provider-walk';
import type { ProductSim } from './sim';

/**
 * Sign in through the client auth port, against the simulated provider: the
 * port opens the sign-in window in the actor's browser and the person walks
 * the provider's screens there.
 */
export const googleOauthSignIn = defineAction({
  name: 'googleOauthSignIn',
  pool: false,
  act: async (s: ProductSim, actorId: string) => {
    const env = await s.sim.client(actorId);
    const browser = s.sim.browser(actorId);
    // Its own token storage: the probe signs in beside the app, not as it.
    const port = createInhouseAuthClient({
      baseURL: env.serverUrl,
      clock: env.clock,
      timers: env.timers,
      fetch: env.server,
      storage: createInMemoryAuthClientStorage(),
      openAuthSession: browser.openAuthSession,
      callbackUrl: 'gamezilla://sso-callback',
    });
    const ui = await actorUi(s, actorId);
    const signingIn = port.signIn('google');
    await pollUntil(
      s,
      () => Promise.resolve(browser.tab() === null ? null : true),
      {
        maxMs: 15_000,
        description: 'the sign-in window',
      }
    );
    await completeProviderSignIn({
      s,
      ui,
      actorId,
      answers: { provider: 'google', email: actorEmail(s, actorId) },
      done: () => Promise.resolve(browser.tab() === null),
    });
    await signingIn;
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
  const liveClients = new Map<string, Client>();
  for (const id of clientIds) {
    liveClients.set(id, await sim.spawnClient(id));
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
