/**
 * Apple's server-to-server notifications.
 *
 * When an account holder changes something about their relationship with an
 * app outside it — stops using their Apple Account with the app, deletes the
 * Apple Account, or switches Hide My Email forwarding off or on — Apple
 * changes its own state and POSTs `{"payload":"<JWT>"}` to the notification
 * URL registered on the Services ID. The JWT is signed with the same keys as
 * id_tokens; its `events` claim is a JSON *string* (another trap).
 *
 * Here the admin plane plays the account holder: the state change and the
 * delivery happen together, the way they do in production.
 */

import type { IdpAppleEventType, IdpClient } from '../../shared/types';
import type { IdpCtx } from '../idp-context';
import { signIdToken } from '../idp-keys';
import type { IdpStore } from '../idp-state';
import { teamOf } from './apple-identity';

export type AppleEventDelivery = {
  /** False when no URL is registered, egress is off, or the RP said non-2xx. */
  readonly delivered: boolean;
  readonly status: number | null;
  /** The signed payload, so a test can replay or tamper with it. */
  readonly payload: string;
};

const NOTIFICATION_TTL_MS = 5 * 60 * 1000;

async function applyEvent(
  store: IdpStore,
  args: { type: IdpAppleEventType; sub: string; client: IdpClient }
): Promise<Record<string, unknown>> {
  const team = teamOf(args.client, args.client.clientId);
  if (args.type === 'consent-revoked') {
    await store.revokeGrant(args.sub, args.client.clientId);
    return {};
  }
  const forwarding = args.type === 'email-enabled';
  await store.setRelayForwarding(args.sub, team, forwarding);
  const relay = await store.relayAddress(args.sub, team);
  return { email: relay.email, is_private_email: 'true' };
}

async function deliver(
  ctx: IdpCtx,
  url: string | null,
  payload: string
): Promise<Pick<AppleEventDelivery, 'delivered' | 'status'>> {
  if (url === null || ctx.http === null) {
    return { delivered: false, status: null };
  }
  try {
    const res = await ctx.http.fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload }),
    });
    return { delivered: res.ok, status: res.status };
  } catch {
    return { delivered: false, status: null };
  }
}

async function notify(
  ctx: IdpCtx,
  args: {
    readonly client: IdpClient;
    readonly type: IdpAppleEventType;
    readonly sub: string;
    readonly issuer: string;
    readonly extra: Record<string, unknown>;
  }
): Promise<AppleEventDelivery> {
  const nowMs = ctx.store.clock.now();
  const events = JSON.stringify({
    type: args.type,
    sub: args.sub,
    event_time: nowMs,
    ...args.extra,
  });
  const payload = await signIdToken({
    keys: ctx.store.keys,
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + NOTIFICATION_TTL_MS,
    claims: {
      iss: args.issuer,
      aud: args.client.clientId,
      jti: ctx.store.createId(),
      events,
    },
  });
  const url = args.client.apple?.notificationUrl ?? null;
  return { ...(await deliver(ctx, url, payload)), payload };
}

/** One account, one app: consent revoked, or relay forwarding toggled. */
export async function emitAppleEvent(
  ctx: IdpCtx,
  args: {
    readonly type: IdpAppleEventType;
    readonly sub: string;
    readonly clientId: string;
    readonly issuer: string;
  }
): Promise<AppleEventDelivery | { readonly error: string }> {
  if (args.type === 'account-delete') {
    const all = await deleteAppleAccount(ctx, args.sub, args.issuer);
    return (
      all.find((d) => d.clientId === args.clientId) ?? { error: 'no grant' }
    );
  }
  const client = await ctx.store.client(args.clientId);
  if (client === null) return { error: 'unknown client' };
  if ((await ctx.store.accountBySub(args.sub)) === null) {
    return { error: 'unknown account' };
  }
  const extra = await ctx.store.tx((store) =>
    applyEvent(store, { type: args.type, sub: args.sub, client })
  );
  return await notify(ctx, { ...args, client, extra });
}

/**
 * The holder deleted their Apple Account: it is gone from the directory, and
 * every app they had authorized hears `account-delete`.
 */
export async function deleteAppleAccount(
  ctx: IdpCtx,
  sub: string,
  issuer: string
): Promise<(AppleEventDelivery & { readonly clientId: string })[]> {
  const grants = await ctx.store.grantsForSub(sub);
  await ctx.store.tx(async (store) => {
    await store.deleteAccount(sub);
  });
  const out: (AppleEventDelivery & { readonly clientId: string })[] = [];
  for (const grant of grants) {
    const client = await ctx.store.client(grant.clientId);
    if (client === null) continue;
    const sent = await notify(ctx, {
      client,
      type: 'account-delete',
      sub,
      issuer,
      extra: {},
    });
    out.push({ ...sent, clientId: grant.clientId });
  }
  return out;
}
