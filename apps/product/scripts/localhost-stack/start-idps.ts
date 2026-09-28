// @io-wall-ok — tools composition root.

/**
 * The stack's two simulated identity providers — Google and Apple — each a
 * `@pkgs/idp-mock` process on its own port with its own state, and the API
 * bindings that point the Worker at them.
 */

import { type ChildProcess, spawn } from 'node:child_process';

import { createAppleClientKeys } from '@pkgs/idp-mock/server/idp-keys';
import type { IdpProviderKind } from '@pkgs/idp-mock/shared';

import { waitForHttp } from './free-port';
import type { IdpStateMode } from './stack-options';

const GOOGLE_CLIENT_ID = 'localhost-stack.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = 'localhost-stack-google-secret';
const APPLE_CLIENT_ID = 'dev.localhost-stack.signin';
const APPLE_TEAM_ID = 'STACKTEAM1';
const APPLE_KEY_ID = 'STACKKEY01';

export type IdpState = {
  readonly mode: IdpStateMode;
  readonly path: string | null;
};

export type StackIdps = {
  readonly google: ChildProcess;
  readonly apple: ChildProcess;
  /** Worker bindings for both providers. */
  readonly apiEnv: Readonly<Record<string, string>>;
};

/** Apple keeps its own file beside Google's: `idp.sqlite` → `idp.apple.sqlite`. */
function appleState(state: IdpState): IdpState {
  if (state.path === null) return state;
  const path = state.path.endsWith('.sqlite')
    ? `${state.path.slice(0, -'.sqlite'.length)}.apple.sqlite`
    : `${state.path}.apple`;
  return { mode: state.mode, path };
}

async function startIdp(args: {
  readonly repoRoot: string;
  readonly provider: IdpProviderKind;
  readonly port: number;
  readonly state: IdpState;
  readonly env: Readonly<Record<string, string>>;
}): Promise<ChildProcess> {
  const child = spawn(
    'bun',
    [
      '--conditions=browser',
      '--conditions=development',
      '--preload',
      './pkgs/bun-test-solid/src/register.ts',
      'pkgs/idp-mock/scripts/serve.ts',
    ],
    {
      cwd: args.repoRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...args.env,
        IDP_PROVIDER: args.provider,
        IDP_PORT: String(args.port),
        IDP_STATE_MODE: args.state.mode,
        ...(args.state.path === null
          ? {}
          : { IDP_STATE_PATH: args.state.path }),
        IDP_APP_NAME: 'Gamezilla',
      },
    }
  );
  await waitForHttp(
    `http://127.0.0.1:${String(args.port)}/.well-known/openid-configuration`
  );
  return child;
}

/**
 * Boot both providers. The Apple one holds the public half of a key minted
 * here; the API nodes get the private half to sign their client secret with,
 * exactly as a developer's downloaded `.p8` key splits between Apple and them.
 */
export async function startStackIdps(args: {
  readonly repoRoot: string;
  readonly apiOrigin: string;
  readonly ports: { readonly google: number; readonly apple: number };
  readonly state: IdpState;
}): Promise<StackIdps> {
  const keys = await createAppleClientKeys();
  const callback = (provider: IdpProviderKind): string =>
    `${args.apiOrigin}/api/auth/callback/${provider}`;
  const started = await Promise.allSettled([
    startIdp({
      repoRoot: args.repoRoot,
      provider: 'google',
      port: args.ports.google,
      state: args.state,
      env: {
        IDP_CLIENT_ID: GOOGLE_CLIENT_ID,
        IDP_CLIENT_SECRET: GOOGLE_CLIENT_SECRET,
        IDP_REDIRECT_URIS: callback('google'),
      },
    }),
    startIdp({
      repoRoot: args.repoRoot,
      provider: 'apple',
      port: args.ports.apple,
      state: appleState(args.state),
      env: {
        IDP_CLIENT_ID: APPLE_CLIENT_ID,
        IDP_REDIRECT_URIS: callback('apple'),
        IDP_APPLE_TEAM_ID: APPLE_TEAM_ID,
        IDP_APPLE_KEY_ID: APPLE_KEY_ID,
        IDP_APPLE_PUBLIC_JWK: JSON.stringify(keys.publicJwk),
        IDP_APPLE_NOTIFICATION_URL: `${args.apiOrigin}/api/auth/apple/notifications`,
      },
    }),
  ]);
  const [google, apple] = started;
  if (google.status === 'rejected' || apple.status === 'rejected') {
    for (const result of started) {
      if (result.status === 'fulfilled') result.value.kill('SIGTERM');
    }
    const failed = google.status === 'rejected' ? google : apple;
    throw failed.status === 'rejected' ? failed.reason : new Error('idp boot');
  }
  return {
    google: google.value,
    apple: apple.value,
    apiEnv: {
      WEB_CLIENT_GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID,
      WEB_CLIENT_GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET,
      GOOGLE_IDP_ORIGIN: `http://127.0.0.1:${String(args.ports.google)}`,
      APPLE_IDP_ORIGIN: `http://127.0.0.1:${String(args.ports.apple)}`,
      APPLE_CLIENT_ID,
      APPLE_TEAM_ID,
      APPLE_KEY_ID,
      APPLE_PRIVATE_JWK: JSON.stringify(keys.privateJwk),
    },
  };
}
