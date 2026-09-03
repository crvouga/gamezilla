import {
  AUTH_SET_TOKEN_HEADER,
  type IDP_PROVIDER_DEV,
  IDP_PROVIDER_GOOGLE,
} from '../../shared/auth-constants';
import type { ActorState, AuthStore, AuthSurface } from './types';

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

function actorOf(surface: AuthSurface, clientId: string): ActorState | null {
  return surface.clients.get(clientId) ?? null;
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
  surface: AuthSurface,
  actor: ActorState,
  subject: string
): Promise<void> {
  if (actor.pendingAuthUrl === null) return;
  const store = surface.store;
  const state = new URL(actor.pendingAuthUrl).searchParams.get('state') ?? '';
  const code = surface.session.ports.createId();
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
  surface: AuthSurface,
  actor: ActorState,
  subject: string
): Promise<void> {
  if (actor.pendingAuthUrl === null) return;
  const store = surface.store;
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
  surface: AuthSurface,
  clientId: string,
  provider: OauthProvider,
  callbackUrl: string
): Promise<void> {
  const actor = actorOf(surface, clientId);
  if (actor === null) return;
  await oauthStart(surface.store, actor, provider, callbackUrl);
}

export async function dispatchOauthApprove(
  surface: AuthSurface,
  clientId: string,
  provider: OauthProvider,
  subject: string
): Promise<void> {
  const actor = actorOf(surface, clientId);
  if (actor === null) return;
  if (provider === IDP_PROVIDER_GOOGLE) {
    await googleApprove(surface, actor, subject);
    return;
  }
  await devApprove(surface, actor, subject);
}

export async function dispatchSessionExchange(
  surface: AuthSurface,
  clientId: string
): Promise<void> {
  const actor = actorOf(surface, clientId);
  if (actor === null) return;
  await sessionExchange(surface.store, actor);
}

export async function dispatchSignOut(
  surface: AuthSurface,
  clientId: string
): Promise<void> {
  const actor = actorOf(surface, clientId);
  if (actor === null) return;
  await signOut(surface.store, actor);
}

export function dispatchStealBearer(
  surface: AuthSurface,
  from: string,
  to: string
): void {
  const src = surface.clients.get(from);
  const dst = surface.clients.get(to);
  if (src === undefined || dst === undefined) return;
  dst.bearer = src.bearer;
}
