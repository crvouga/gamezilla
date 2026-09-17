// @io-wall-ok — loopback process adapter for the simulated Google IdP.

/**
 * Bind the IdP to a loopback port. Port `0` asks the OS for a free one, which
 * is what lets several full stacks run side by side on one machine.
 */

import { wallClock } from '@pkgs/clock';
import {
  createGoogleIdpApp,
  type GoogleIdp,
} from '../src/server/create-idp-app';
import { createIdpSigningKeys } from '../src/server/idp-keys';
import type { IdpAccountDraft } from '../src/server/idp-seed';
import type { IdpClient } from '../src/shared/types';

export type StartIdpServerOptions = {
  /** `0` (default) takes an OS-assigned port. */
  readonly port?: number;
  readonly hostname?: string;
  readonly clients: readonly IdpClient[];
  readonly accounts?: readonly IdpAccountDraft[];
};

export type IdpServerHandle = {
  readonly origin: string;
  readonly port: number;
  readonly idp: GoogleIdp;
  stop(): Promise<void>;
};

export async function startGoogleIdpServer(
  options: StartIdpServerOptions
): Promise<IdpServerHandle> {
  const keys = await createIdpSigningKeys();
  const idp = createGoogleIdpApp({
    clock: wallClock,
    createId: () => crypto.randomUUID(),
    keys,
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
    stop: () => server.stop(true),
  };
}
