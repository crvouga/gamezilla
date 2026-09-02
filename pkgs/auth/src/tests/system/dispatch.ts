import type { World } from '@pkgs/determinism';
import {
  AUTH_SET_TOKEN_HEADER,
  type IDP_PROVIDER_DEV,
  IDP_PROVIDER_GOOGLE,
} from '../../shared/auth-constants';
import type { ActorState, AuthKit, AuthStore } from './types';

type AuthWorld = World<
  Record<string, import('@pkgs/determinism').KnobDef>,
  Record<string, import('@pkgs/determinism').NodeSpecEntry>,
  AuthKit
>;

export type OauthProvider =
  | typeof IDP_PROVIDER_GOOGLE
  | typeof IDP_PROVIDER_DEV;

const JSON_HEADERS = { 'content-type': 'application/json' };

async function readToken(res: Response): Promise<string | null> {
  const body = (await res.json()) as { token?: string };
  return typeof body.token === 'string'
    ? body.token
    : res.headers.get(AUTH_SET_TOKEN_HEADER);
}

function actorOf(world: AuthWorld, clientId: string): ActorState | null {
  return world.nodes['client'].get(clientId) ?? null;
}

function storeOf(world: AuthWorld): AuthStore {
  return world.nodes['store'] as AuthStore;
}

async function oauthStart(
  store: AuthStore,
  actor: ActorState,
  provider: OauthProvider,
  callbackUrl: string
): Promise<void> {
  const launchPath = `/auth/oauth/launch?provider=${encodeURIComponent(provider)}&callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const res = await store.fetch(launchPath, {
    method: 'GET',
    redirect: 'manual',
  });
  const location = res.headers.get('location');
  actor.pendingAuthUrl = location;
}

async function googleApprove(
  world: AuthWorld,
  actor: ActorState,
  subject: string
): Promise<void> {
  if (actor.pendingAuthUrl === null) return;
  const store = storeOf(world);
  const state = new URL(actor.pendingAuthUrl).searchParams.get('state') ?? '';
  const code = world.deps.createId();
  store.sim.googleSubjects.set(code, subject);
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

async function devApprove(
  world: AuthWorld,
  actor: ActorState,
  subject: string
): Promise<void> {
  if (actor.pendingAuthUrl === null) return;
  const store = storeOf(world);
  const authorizeUrl = new URL(actor.pendingAuthUrl);
  const state = authorizeUrl.searchParams.get('state') ?? '';
  const completeRes = await store.fetch('/auth/dev/authorize/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ state, subject }).toString(),
    redirect: 'manual',
  });
  const callbackLocation = completeRes.headers.get('location');
  if (callbackLocation === null) {
    actor.pendingCode = null;
    return;
  }
  const callbackRes = await store.fetch(
    new URL(callbackLocation).pathname + new URL(callbackLocation).search,
    { method: 'GET', redirect: 'manual' }
  );
  const appLocation = callbackRes.headers.get('location');
  if (appLocation === null) {
    actor.pendingCode = null;
    return;
  }
  actor.pendingCode = new URL(appLocation).searchParams.get('code');
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

export async function dispatchOauthStart(
  world: AuthWorld,
  clientId: string,
  provider: OauthProvider,
  callbackUrl: string
): Promise<void> {
  const actor = actorOf(world, clientId);
  if (actor === null) return;
  await oauthStart(storeOf(world), actor, provider, callbackUrl);
}

export async function dispatchOauthApprove(
  world: AuthWorld,
  clientId: string,
  provider: OauthProvider,
  subject: string
): Promise<void> {
  const actor = actorOf(world, clientId);
  if (actor === null) return;
  if (provider === IDP_PROVIDER_GOOGLE) {
    await googleApprove(world, actor, subject);
    return;
  }
  await devApprove(world, actor, subject);
}

export async function dispatchSessionExchange(
  world: AuthWorld,
  clientId: string
): Promise<void> {
  const actor = actorOf(world, clientId);
  if (actor === null) return;
  await sessionExchange(storeOf(world), actor);
}

export async function dispatchSignOut(
  world: AuthWorld,
  clientId: string
): Promise<void> {
  const actor = actorOf(world, clientId);
  if (actor === null) return;
  await signOut(storeOf(world), actor);
}

export function dispatchStealBearer(
  world: AuthWorld,
  from: string,
  to: string
): void {
  const actors = world.nodes['client'] as ReadonlyMap<string, ActorState>;
  const src = actors.get(from);
  const dst = actors.get(to);
  if (src === undefined || dst === undefined) return;
  dst.bearer = src.bearer;
}
