import type { DstWorld, JsonValue } from '@pkgs/dst';
import { AUTH_SET_TOKEN_HEADER } from '../../shared/auth-constants';
import type { AuthDomainOp } from './actions';
import {
  type ActorState,
  type AuthStore,
  type AuthSystem,
  requireStore,
} from './types';

type AuthWorld = DstWorld<AuthSystem>;

const JSON_HEADERS = { 'content-type': 'application/json' };

async function readToken(res: Response): Promise<string | null> {
  const body = (await res.json()) as { token?: string };
  return typeof body.token === 'string'
    ? body.token
    : res.headers.get(AUTH_SET_TOKEN_HEADER);
}

async function devComplete(
  store: AuthStore,
  actor: ActorState,
  subject: string
): Promise<void> {
  const res = await store.fetch('/auth/oauth/dev/complete', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ subject }),
  });
  if (!res.ok) return;
  actor.bearer = await readToken(res);
}

async function googleStart(
  store: AuthStore,
  actor: ActorState,
  callbackUrl: string
): Promise<void> {
  const res = await store.fetch('/auth/oauth/start', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ provider: 'google', callbackUrl }),
  });
  if (!res.ok) {
    actor.pendingAuthUrl = null;
    return;
  }
  const body = (await res.json()) as { authorizationUrl?: string };
  actor.pendingAuthUrl = body.authorizationUrl ?? null;
}

async function googleApprove(
  world: AuthWorld,
  actor: ActorState,
  subject: string
): Promise<void> {
  if (actor.pendingAuthUrl === null) return;
  const store = requireStore(world.system);
  const state = new URL(actor.pendingAuthUrl).searchParams.get('state') ?? '';
  const code = world.deps.createId();
  world.system.googleSubjects.set(code, subject);
  const query = `code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
  const res = await store.fetch(`/auth/callback/google?${query}`, {
    method: 'GET',
    redirect: 'manual',
  });
  const location = res.headers.get('location');
  if (location === null) {
    actor.pendingCode = null;
    return;
  }
  actor.pendingCode = new URL(location).searchParams.get('code');
  actor.pendingAuthUrl = null;
}

async function sessionExchange(
  store: AuthStore,
  actor: ActorState
): Promise<void> {
  if (actor.pendingCode === null) return;
  const res = await store.fetch('/auth/session', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ code: actor.pendingCode }),
  });
  actor.pendingCode = null;
  if (!res.ok) return;
  actor.bearer = await readToken(res);
}

async function signOut(store: AuthStore, actor: ActorState): Promise<void> {
  if (actor.bearer === null) return;
  await store.fetch('/auth/sign-out', {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      authorization: `Bearer ${actor.bearer}`,
    },
    body: '{}',
  });
  actor.bearer = null;
}

function stealBearer(world: AuthWorld, from: string, to: string): void {
  const src = world.system.actors.get(from);
  const dst = world.system.actors.get(to);
  if (src === undefined || dst === undefined) return;
  dst.bearer = src.bearer;
}

export async function dispatchAuthDomainOp(
  world: AuthWorld,
  op: JsonValue
): Promise<void> {
  const action = op as AuthDomainOp;
  if (action.kind === 'stealBearer') {
    stealBearer(world, action.from, action.to);
    return;
  }
  const store = requireStore(world.system);
  const actor = world.system.actors.get(action.clientId);
  if (actor === undefined) return;
  switch (action.kind) {
    case 'devComplete':
      await devComplete(store, actor, action.subject);
      return;
    case 'googleStart':
      await googleStart(store, actor, action.callbackUrl);
      return;
    case 'googleApprove':
      await googleApprove(world, actor, action.subject);
      return;
    case 'sessionExchange':
      await sessionExchange(store, actor);
      return;
    case 'signOut':
      await signOut(store, actor);
      return;
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
    }
  }
}
