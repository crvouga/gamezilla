/**
 * The identity provider node of the auth simulation.
 *
 * It is the same simulated Google used by the localhost stack, mounted
 * in-process on its own origin. The auth app reaches it only over HTTP, so
 * the production token-exchange path is what the simulation exercises.
 */

import type { HttpClient } from '@pkgs/http-client';
import {
  createGoogleIdpApp,
  createIdpSigningKeys,
  type GoogleIdp,
} from '@pkgs/idp-google-sim/server';
import type { Ports } from '@pkgs/sim';

export const IDP_ORIGIN = 'http://idp.test';
export const IDP_CLIENT_ID = 'auth-sim.apps.googleusercontent.com';
export const IDP_CLIENT_SECRET = 'auth-sim-client-secret';
/** Subjects the walks sign in as; passwords are uniform by construction. */
export const IDP_SUBJECTS = ['alice', 'bob', 'carol'] as const;
export const IDP_PASSWORD = 'hunter2-hunter2';

export function idpAccountEmail(subject: string): string {
  return `${subject}@gmail.com`;
}

export async function startIdpNode(args: {
  readonly ports: Ports;
  readonly redirectUri: string;
}): Promise<GoogleIdp> {
  return createGoogleIdpApp({
    clock: args.ports.clock,
    createId: args.ports.createId,
    keys: await createIdpSigningKeys(),
    issuer: IDP_ORIGIN,
    clients: [
      {
        clientId: IDP_CLIENT_ID,
        clientSecret: IDP_CLIENT_SECRET,
        redirectUris: [args.redirectUri],
        appName: 'Auth Simulation',
      },
    ],
    accounts: IDP_SUBJECTS.map((handle) => ({ handle })),
  });
}

/**
 * The auth app's outbound HTTP. Only the provider origin is routable — a call
 * to anywhere else is a bug worth failing on.
 */
export function createIdpHttpClient(idp: GoogleIdp): HttpClient {
  return {
    async fetch(input, init) {
      const url = String(input);
      if (!url.startsWith(IDP_ORIGIN)) {
        return new Response('not found', { status: 404 });
      }
      return idp.app.fetch(new Request(url, init));
    },
  };
}
