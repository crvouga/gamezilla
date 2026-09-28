// @io-wall-ok — loopback process adapter for the simulated IdPs.

/**
 * Bind the IdP to a loopback port. Port `0` asks the OS for a free one, which
 * is what lets several full stacks run side by side on one machine.
 *
 * Durability is a property of the SQLite database opened here: in memory by
 * default, or an explicit file the caller resolved. `memory` is still SQLite;
 * there is no map-backed mode left.
 */

import { wallClock } from '@pkgs/clock';
import { createGlobalHttpClient } from '@pkgs/http-client/global';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';

import {
  createIdpMockApp,
  createIdpSigningKeys,
  type IdpMock,
  IdpStore,
} from '../src/server/index';
import type {
  IdpAccountDraft,
  IdpClient,
  IdpProviderKind,
} from '../src/shared/index';

/** Where the provider keeps its state. */
export type IdpStateLocation =
  | { readonly kind: 'memory' }
  | { readonly kind: 'file'; readonly path: string };

export type StartIdpServerOptions = {
  /** Which provider's wire to speak. Default `google`. */
  readonly provider?: IdpProviderKind;
  /** `0` (default) takes an OS-assigned port. */
  readonly port?: number;
  readonly hostname?: string;
  readonly clients: readonly IdpClient[];
  readonly accounts?: readonly IdpAccountDraft[];
  /** Default `{ kind: 'memory' }`. */
  readonly state?: IdpStateLocation;
};

export type IdpServerHandle = {
  readonly origin: string;
  readonly port: number;
  readonly idp: IdpMock;
  stop(): Promise<void>;
};

export async function startIdpMockServer(
  options: StartIdpServerOptions
): Promise<IdpServerHandle> {
  const location = options.state ?? { kind: 'memory' };
  const sqlClient =
    location.kind === 'memory'
      ? SqlClientImplBunSqlite.openMemory()
      : SqlClientImplBunSqlite.open(location.path);
  await sqlClient.connect();
  const store = await IdpStore.open({
    provider: options.provider ?? 'google',
    sqlClient,
    clock: wallClock,
    createId: () => crypto.randomUUID(),
    createKeys: () => createIdpSigningKeys(),
  });
  const idp = await createIdpMockApp({
    store,
    http: createGlobalHttpClient(),
    clients: options.clients,
    ...(options.accounts === undefined ? {} : { accounts: options.accounts }),
  });
  const server = Bun.serve({
    port: options.port ?? 0,
    hostname: options.hostname ?? '127.0.0.1',
    fetch: (request) => idp.app.fetch(request),
  });
  return {
    origin: server.url.origin,
    port: Number(server.url.port),
    idp,
    async stop() {
      await server.stop(true);
      await sqlClient.disconnect();
    },
  };
}
