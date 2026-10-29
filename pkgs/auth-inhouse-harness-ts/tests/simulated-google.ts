/**
 * Google, simulated (`@crvouga/mockingbird-service-oauth` on Google's wire
 * profile): one origin serving Google's authorize, token, userinfo and JWKS
 * paths, with Alice in its directory and the relying party registered as its
 * one client. Tests reach it only over HTTP, as the auth app does.
 */
import {
  createRuntime,
  type OAuthRuntimeOptions,
} from '@crvouga/mockingbird-service-oauth';
import type { Clock } from '@pkgs/clock-shared-ts/types';

/** The address Alice signs in with. */
export const ALICE_EMAIL = 'alice@gmail.com';

type ProviderClock = NonNullable<OAuthRuntimeOptions['clock']>;

function providerClock(clock: Clock): ProviderClock {
  return {
    now: () => clock.now(),
    set: () => undefined,
    advance: () => undefined,
    freeze: () => undefined,
    unfreeze: () => undefined,
    reset: () => undefined,
    state: () => ({ now: clock.now(), frozen: false, offsetMs: 0 }),
  };
}

export function simulatedGoogle(args: {
  readonly origin: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUris: readonly string[];
  readonly clock: Clock;
}): (request: Request) => Promise<Response> {
  const runtime = createRuntime({
    provider: 'google',
    issuer: args.origin,
    clock: providerClock(args.clock),
    clients: [
      {
        id: args.clientId,
        name: 'Example App',
        secret: args.clientSecret,
        redirectUris: [...args.redirectUris],
      },
    ],
    accounts: [{ id: 'alice', email: ALICE_EMAIL, name: 'Alice Tester' }],
  });
  return async (request) => await runtime.fetch(request);
}
