import {
  AUTH_SET_TOKEN_HEADER,
  IDP_PROVIDER_GOOGLE,
} from '@pkgs/auth/shared/auth-constants';
import { walkIdpScreens } from './idp-walk';
import type { ActorState, AuthStore, AuthSurface } from './types';

export type OauthProvider = typeof IDP_PROVIDER_GOOGLE;

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
  callbackUrl: string
): Promise<void> {
  const launchPath = `/auth/oauth/launch?provider=${IDP_PROVIDER_GOOGLE}&callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const res = await store.fetch(launchPath, {
    method: 'GET',
    redirect: 'manual',
  });
  const location = res.headers.get('location');
  actor.pendingAuthUrl = location;
}

/**
 * Walk the provider's real screens: sign in, approve consent, ride the
 * redirect back through the auth callback to the app.
 */
async function googleApprove(
  surface: AuthSurface,
  actor: ActorState,
  subject: string
): Promise<void> {
  if (actor.pendingAuthUrl === null) return;
  actor.pendingCode = await walkIdpScreens({
    wire: surface.store.wire,
    startUrl: actor.pendingAuthUrl,
    subject,
  });
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
  callbackUrl: string
): Promise<void> {
  const actor = actorOf(surface, clientId);
  if (actor === null) return;
  await oauthStart(surface.store, actor, callbackUrl);
}

export async function dispatchOauthApprove(
  surface: AuthSurface,
  clientId: string,
  subject: string
): Promise<void> {
  const actor = actorOf(surface, clientId);
  if (actor === null) return;
  await googleApprove(surface, actor, subject);
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
