import type { World } from '@pkgs/determinism';
import { AUTH_SET_TOKEN_HEADER } from '../../shared/auth-constants';
import {
  type ActorState,
  type AuthStore,
  type AuthSystem,
  requireStore,
} from './types';

type AuthWorld = World<AuthSystem>;

const JSON_HEADERS = { 'content-type': 'application/json' };

async function readToken(res: Response): Promise<string | null> {
  const body = (await res.json()) as { token?: string };
  return typeof body.token === 'string'
    ? body.token
    : res.headers.get(AUTH_SET_TOKEN_HEADER);
}

function actorOf(world: AuthWorld, clientId: string): ActorState | null {
  return world.state.actors.get(clientId) ?? null;
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
  const store = requireStore(world.state);
  const state = new URL(actor.pendingAuthUrl).searchParams.get('state') ?? '';
  const code = world.deps.createId();
  world.state.googleSubjects.set(code, subject);
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

export async function dispatchDevComplete(
  world: AuthWorld,
  clientId: string,
  subject: string
): Promise<void> {
  const actor = actorOf(world, clientId);
  if (actor === null) return;
  await devComplete(requireStore(world.state), actor, subject);
}

export async function dispatchGoogleStart(
  world: AuthWorld,
  clientId: string,
  callbackUrl: string
): Promise<void> {
  const actor = actorOf(world, clientId);
  if (actor === null) return;
  await googleStart(requireStore(world.state), actor, callbackUrl);
}

export async function dispatchGoogleApprove(
  world: AuthWorld,
  clientId: string,
  subject: string
): Promise<void> {
  const actor = actorOf(world, clientId);
  if (actor === null) return;
  await googleApprove(world, actor, subject);
}

export async function dispatchSessionExchange(
  world: AuthWorld,
  clientId: string
): Promise<void> {
  const actor = actorOf(world, clientId);
  if (actor === null) return;
  await sessionExchange(requireStore(world.state), actor);
}

export async function dispatchSignOut(
  world: AuthWorld,
  clientId: string
): Promise<void> {
  const actor = actorOf(world, clientId);
  if (actor === null) return;
  await signOut(requireStore(world.state), actor);
}

export function dispatchStealBearer(
  world: AuthWorld,
  from: string,
  to: string
): void {
  const src = world.state.actors.get(from);
  const dst = world.state.actors.get(to);
  if (src === undefined || dst === undefined) return;
  dst.bearer = src.bearer;
}
