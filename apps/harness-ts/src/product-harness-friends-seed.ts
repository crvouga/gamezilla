/**
 * What a world nobody has visited before starts with: two people, signed in
 * on a device each, who are already friends.
 *
 * It is made the way a person would make it, only without a screen: each one
 * walks the identity provider's sign-in in their own browser, their device
 * keeps the session the server answers with, and the friendship is the
 * ordinary request and its acceptance. The console then opens each device's
 * app, which starts signed in.
 */

import { createAppBearerTokenStore } from '@libs/app-root-shared-ts/auth-client-storage';
import {
  DEVICE_ID_KEY,
  LAST_LOCAL_ACCOUNT_ID_KEY,
} from '@libs/auth-shared-ts/auth-storage-keys';
import { refreshAuth } from '@libs/auth-shared-ts/refresh-auth-fetch';
import { SessionCapabilityStore } from '@libs/auth-shared-ts/session-capability';
import type { Harness } from '@libs/harness-ts/create-harness';
import { harnessIdpEmail } from '@libs/harness-ts/idp';
import { HARNESS_SERVER_URL } from '@libs/sub-shared-ts/harness-constants';
import { buildOauthLaunchUrl } from '@pkgs/auth-inhouse-client-ts/auth-client-http';
import { createNamespacedAuthClientStorage } from '@pkgs/auth-inhouse-client-ts/bearer-token-storage-web';
import { createInProcessOpenAuthSession } from '@pkgs/auth-inhouse-client-ts/in-process-open-auth-session';
import type { HttpFetch } from '@pkgs/http-client-shared-ts/types';
import {
  type MutationBatchRequest,
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from '@pkgs/sync-engine-shared-ts/v2';

/** The two people, by the name each is known by; also their device's id. */
export const SEEDED_FRIENDS = ['alice', 'bob'] as const;

const CALLBACK_URL = `${HARNESS_SERVER_URL}/sso-callback`;

type SignedIn = {
  readonly id: string;
  readonly accountId: string;
  /** Sends one mutation as this person, from this device. */
  mutate(name: string, args: unknown): Promise<void>;
};

async function answered(what: string, response: Response): Promise<unknown> {
  const text = await response.text();
  if (!response.ok)
    throw new Error(
      `${what}: HTTP ${String(response.status)} ${text.slice(0, 200)}`
    );
  return JSON.parse(text) as unknown;
}

/** The session the server gives for a finished provider sign-in. */
async function providerSession(
  harness: Harness,
  id: string,
  server: HttpFetch
): Promise<{
  readonly token: string;
  readonly expiresAt: string | null;
  readonly externalUserId: string;
}> {
  const open = createInProcessOpenAuthSession({
    fetch: harness.browser(id).fetch,
    account: { email: harnessIdpEmail(id) },
  });
  const result = await open(
    buildOauthLaunchUrl({
      baseURL: HARNESS_SERVER_URL,
      provider: 'google',
      callbackUrl: CALLBACK_URL,
    }),
    CALLBACK_URL
  );
  const code =
    result.type === 'success' && typeof result.url === 'string'
      ? new URL(result.url).searchParams.get('code')
      : null;
  if (code === null) throw new Error(`${id}: the provider sign-in did not end`);
  const session = (await answered(
    `${id}: session`,
    await server(`${HARNESS_SERVER_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    })
  )) as {
    readonly token?: unknown;
    readonly expiresAt?: unknown;
    readonly user?: { readonly id?: unknown };
  };
  if (typeof session.token !== 'string' || typeof session.user?.id !== 'string')
    throw new Error(`${id}: the server answered no session`);
  return {
    token: session.token,
    expiresAt: typeof session.expiresAt === 'string' ? session.expiresAt : null,
    externalUserId: session.user.id,
  };
}

function mutator(args: {
  readonly harness: Harness;
  readonly id: string;
  readonly server: HttpFetch;
  readonly token: string;
  readonly deviceId: string;
}): SignedIn['mutate'] {
  let seq = 0;
  return async (name, mutationArgs) => {
    seq += 1;
    const batch: MutationBatchRequest = {
      mutations: [
        {
          id: args.harness.server.createId(),
          name,
          args: JSON.stringify(mutationArgs),
          clientId: `seed:${args.id}`,
          seq,
          createdAt: new Date(args.harness.clock.now()).toISOString(),
          originTraceparent: null,
        },
      ],
    };
    const result = (await answered(
      `${args.id}: ${name}`,
      await args.server(`${HARNESS_SERVER_URL}/api/mutations`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION),
          authorization: `Bearer ${args.token}`,
          'x-anon-id': args.deviceId,
        },
        body: JSON.stringify(batch),
      })
    )) as {
      readonly verdicts?: readonly {
        readonly status?: string;
        readonly code?: string;
        readonly message?: string;
      }[];
    };
    const verdict = result.verdicts?.[0];
    if (verdict?.status !== 'applied')
      throw new Error(
        `${args.id}: ${name} was not applied (${verdict?.code ?? 'no verdict'} ${verdict?.message ?? ''})`
      );
  };
}

/** Sign one person in on their own device and leave the device signed in. */
async function signIn(harness: Harness, id: string): Promise<SignedIn> {
  const env = await harness.client(id);
  const session = await providerSession(harness, id, env.server);
  const deviceId = harness.server.createId();
  const { accountId } = await refreshAuth({
    apiUrl: HARNESS_SERVER_URL,
    bearerToken: session.token,
    deviceId,
    fetchFn: env.server,
    deviceSnapshot: {},
  });
  await env.secureStorage.write(DEVICE_ID_KEY, deviceId);
  await env.secureStorage.write(LAST_LOCAL_ACCOUNT_ID_KEY, accountId);
  await new SessionCapabilityStore(env.secureStorage).write(session);
  await createAppBearerTokenStore(
    createNamespacedAuthClientStorage(harness.clientNamespace(id))
  ).write(session.token);
  const mutate = mutator({
    harness,
    id,
    server: env.server,
    token: session.token,
    deviceId,
  });
  // A new account is given a generated name until the person picks one.
  await mutate('ensureProfile', { username: id });
  return { id, accountId, mutate };
}

/** Returns the devices to open, in order. */
export async function seedFriends(
  harness: Harness
): Promise<readonly string[]> {
  const [alice, bob] = [
    await signIn(harness, SEEDED_FRIENDS[0]),
    await signIn(harness, SEEDED_FRIENDS[1]),
  ];
  const requestId = harness.server.createId();
  await alice.mutate('sendFriendRequest', {
    requestId,
    toUserId: bob.accountId,
  });
  await bob.mutate('acceptFriendRequest', { requestId });
  return SEEDED_FRIENDS;
}
