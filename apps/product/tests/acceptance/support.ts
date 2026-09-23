import { expect } from 'bun:test';
import {
  type ApiRequest,
  type acceptanceApi,
  providerIdentity,
  request,
  response,
} from '@apps/product/sim/acceptance/system';

export type ApiRun = Awaited<ReturnType<typeof acceptanceApi.run>>;
export type Actor = {
  deviceId: string;
  token: string;
  accountId: string;
  seq: number;
};
export type Json = {
  readonly [key: string]:
    | string
    | number
    | boolean
    | null
    | undefined
    | Json
    | readonly Json[];
};
export const CALLBACK = 'http://localhost:5173/sso-callback';
export const deviceId = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export async function call(s: ApiRun, input: Omit<ApiRequest, 'key'>) {
  await s.apply(request, { key: 'last', ...input });
  return s.read(response, 'last');
}

export function headers(actor: Actor): Record<string, string> {
  return {
    authorization: `Bearer ${actor.token}`,
    'x-anon-id': actor.deviceId,
    'x-sync-protocol': '3',
  };
}

export async function googleCode(
  s: ApiRun,
  identity: {
    sub: string;
    email: string | null;
    verified?: boolean;
  },
  actor?: Actor
) {
  await s.apply(providerIdentity, {
    ...identity,
    verified: identity.verified ?? true,
  });
  const start = await call(s, {
    path: `/auth/oauth/launch?provider=google&callbackUrl=${encodeURIComponent(CALLBACK)}${actor ? '&intent=link' : ''}`,
    method: 'GET',
    ...(actor ? { headers: headers(actor) } : {}),
  });
  expect(start.status).toBe(302);
  const state = new URL(start.headers['location']!).searchParams.get('state');
  expect(state).toBeTruthy();
  const callback = await call(s, {
    path: `/auth/callback/google?code=fixture-code&state=${state}`,
    method: 'GET',
  });
  expect(callback.status).toBe(302);
  const code = new URL(callback.headers['location']!).searchParams.get('code');
  expect(code).toBeTruthy();
  return { code: code!, state: state! };
}

export async function login(
  s: ApiRun,
  n: number,
  identity: {
    sub: string;
    email: string | null;
    verified?: boolean;
  },
  linkTo?: Actor
): Promise<Actor> {
  const { code } = await googleCode(s, identity, linkTo);
  const session = await call(s, { path: '/auth/session', body: { code } });
  expect(session.status).toBe(200);
  const token = (session.body as Json)['token'];
  if (typeof token !== 'string') throw new Error('session token missing');
  const actor = { token, deviceId: deviceId(n), accountId: '', seq: 0 };
  const refresh = await call(s, {
    path: '/identity/refresh',
    headers: headers(actor),
    body: {},
  });
  expect(refresh.status).toBe(200);
  const accountId = (refresh.body as Json)['accountId'];
  if (typeof accountId !== 'string') throw new Error('account id missing');
  actor.accountId = accountId;
  return actor;
}

export const aliceIdentity = {
  sub: 'alice-google',
  email: 'alice@example.test',
};
export const bobIdentity = { sub: 'bob-google', email: 'bob@example.test' };

export async function mutate(
  s: ApiRun,
  actor: Actor,
  name: string,
  args: Json
) {
  actor.seq += 1;
  const id = `${actor.accountId}:${actor.deviceId}:${actor.seq}`;
  const result = await call(s, {
    path: '/mutations',
    headers: headers(actor),
    body: {
      mutations: [
        {
          id,
          name,
          args: JSON.stringify(args),
          clientId: `${actor.accountId}:${actor.deviceId}`,
          seq: actor.seq,
          createdAt: '2027-01-15T08:00:00.000Z',
        },
      ],
    },
  });
  expect(result.status).toBe(200);
  const verdicts = (result.body as Json)['verdicts'];
  if (!Array.isArray(verdicts)) throw new Error('missing verdicts');
  const verdict = verdicts[0] as Json;
  expect(verdict['mutationId']).toBe(id);
  const status = verdict['status'];
  const code = verdict['code'];
  return {
    status: typeof status === 'string' ? status : '',
    ...(typeof code === 'string' ? { code } : {}),
  };
}

export async function applied(
  s: ApiRun,
  actor: Actor,
  name: string,
  args: Json
) {
  expect((await mutate(s, actor, name, args)).status).toBe('applied');
}

export async function query(
  s: ApiRun,
  actor: Actor,
  name: string,
  params: Json = {}
) {
  const result = await call(s, {
    path: '/query',
    headers: headers(actor),
    body: { queries: [{ name, params }] },
  });
  expect(result.status).toBe(200);
  const responses = (result.body as Json)['responses'];
  if (!Array.isArray(responses)) throw new Error('missing query responses');
  const snapshot = responses[0] as Json;
  expect(snapshot['status']).toBe('ok');
  const tables = snapshot['tables'];
  if (tables === null || typeof tables !== 'object' || Array.isArray(tables)) {
    throw new Error('missing query tables');
  }
  return tables as Record<string, Json[]>;
}

export function live(rows: Json[]) {
  return rows.filter((row) => row['deleted_at'] === null);
}

export function text(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} missing`);
  return value;
}
