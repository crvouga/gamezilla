/**
 * The identity provider node.
 *
 * Production signs in through Google, so the simulation runs a whole
 * simulated Google: its own origin, its own account directory, its own
 * browser sessions and consent grants. Nothing about it is shared with the
 * API — the only way in is the documented OAuth conversation, which means the
 * production exchange path is the one under test.
 *
 * It sits on `createSimNet` like every other node, so it can be partitioned
 * away from a client or from the API and the product has to cope.
 */

import type { ServerHttp } from '@libs/client-app/shell/client-env';
import {
  SIM_GOOGLE_CLIENT_ID,
  SIM_GOOGLE_CLIENT_SECRET,
  SIM_IDP_URL,
  SIM_SERVER_URL,
} from '@libs/feature/public/sim-constants';
import type { Clock } from '@pkgs/clock';
import {
  createGoogleIdpApp,
  createIdpSigningKeys,
  type GoogleIdp,
  IdpStore,
} from '@pkgs/idp-google-sim/server';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

import { requestHref } from './sim-http-request';
import type { SimNet } from './sim-net';

export const SIM_IDP_ID = 'idp';

/** Where the API's Google callback lands (`createServer` mounts under `/api`). */
export const SIM_GOOGLE_REDIRECT_URI = `${SIM_SERVER_URL}/api/auth/callback/google`;

/** Every actor signs in as their own Google account. */
export function simIdpEmail(actorId: string): string {
  return `${actorId}@gmail.com`;
}

export async function createSimIdp(deps: {
  readonly clock: Clock;
  readonly createId: CreateId;
  /** The host's SQLite (in-memory under the default fabric). */
  readonly sqlClient: SqlClient;
}): Promise<GoogleIdp> {
  const store = await IdpStore.open({
    sqlClient: deps.sqlClient,
    clock: deps.clock,
    createId: deps.createId,
    createKeys: () => createIdpSigningKeys(),
  });
  return await createGoogleIdpApp({
    store,
    issuer: SIM_IDP_URL,
    clients: [
      {
        clientId: SIM_GOOGLE_CLIENT_ID,
        clientSecret: SIM_GOOGLE_CLIENT_SECRET,
        redirectUris: [SIM_GOOGLE_REDIRECT_URI],
        appName: 'Gamezilla',
      },
    ],
  });
}

/** A node's HTTP port to the provider, gated by the network. */
export function simIdpFetchFrom(args: {
  readonly idp: GoogleIdp;
  readonly net: SimNet;
  readonly from: string;
}): ServerHttp {
  return args.net.wrapHop(args.from, SIM_IDP_ID, async (input, init) =>
    args.idp.app.fetch(new Request(requestHref(input), init))
  );
}

/**
 * A client's browser: the provider on its own origin, everything else through
 * the load balancer. One port, two destinations — same as a real browser.
 */
export function simBrowserFetch(args: {
  readonly idp: GoogleIdp;
  readonly net: SimNet;
  readonly from: string;
  readonly server: ServerHttp;
}): ServerHttp {
  const toIdp = simIdpFetchFrom(args);
  return async (input, init) => {
    if (requestHref(input).startsWith(SIM_IDP_URL)) return toIdp(input, init);
    return args.server(input, init);
  };
}
