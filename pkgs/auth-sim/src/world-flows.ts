/**
 * The world changing under the app: account holders acting at their
 * provider (revoking the app, deleting the account, switching relay
 * forwarding, changing their address), providers misbehaving, keys rotating.
 */

import type { OauthProviderId } from '@pkgs/auth/shared';
import { IDP_DEFAULT_FAULTS, type IdpFaults } from '@pkgs/idp-sim/shared';
import { sql } from '@pkgs/sql';

import { violate } from './checks';
import { APPLE_CLIENT_ID } from './idp-node';
import { endUserSessions, identitiesOf, identityKey } from './model';
import type { AuthSurface } from './types';

async function appleAdmin(
  s: AuthSurface,
  path: string,
  init: { method: string; body?: unknown }
): Promise<Response> {
  return await s.store.idps.apple.app.fetch(
    new Request(`http://apple.idp.test/__idp${path}`, {
      method: init.method,
      headers: { 'content-type': 'application/json' },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    })
  );
}

async function appleSubOf(
  s: AuthSurface,
  email: string
): Promise<string | null> {
  const account = await s.store.idps.apple.ctx.store.accountByEmail(email);
  return account?.sub ?? null;
}

/** "Stop using Apple Account" with this app: every session of its owner ends. */
export async function appleConsentRevokedFlow(
  s: AuthSurface,
  email: string
): Promise<void> {
  const sub = await appleSubOf(s, email);
  if (sub === null) return;
  await appleAdmin(s, '/grants/revoke', {
    method: 'POST',
    body: { sub, clientId: APPLE_CLIENT_ID },
  });
  const owner = s.model.identities.get(identityKey('apple', sub));
  if (owner !== undefined) endUserSessions(s.model, owner.userId);
}

/**
 * The Apple Account is deleted. Apple notifies only apps that still hold a
 * grant; the identity then goes, and a user left with nothing to sign in
 * with is signed out everywhere.
 */
export async function appleAccountDeletedFlow(
  s: AuthSurface,
  email: string
): Promise<void> {
  const sub = await appleSubOf(s, email);
  if (sub === null) return;
  const store = s.store.idps.apple.ctx.store;
  const notified = (await store.grant(sub, APPLE_CLIENT_ID)) !== null;
  await appleAdmin(s, `/accounts/${sub}`, { method: 'DELETE' });
  s.directory.apple = s.directory.apple.filter((entry) => entry !== email);
  const key = identityKey('apple', sub);
  const owner = s.model.identities.get(key);
  if (!notified || owner === undefined) return;
  s.model.identities.delete(key);
  if (identitiesOf(s.model, owner.userId).length === 0) {
    endUserSessions(s.model, owner.userId);
  }
}

export async function appleRelayForwardingFlow(
  s: AuthSurface,
  email: string,
  forwarding: boolean
): Promise<void> {
  const sub = await appleSubOf(s, email);
  if (sub === null) return;
  await appleAdmin(s, '/events', {
    method: 'POST',
    body: {
      type: forwarding ? 'email-enabled' : 'email-disabled',
      sub,
      clientId: APPLE_CLIENT_ID,
    },
  });
  if (!s.model.identities.has(identityKey('apple', sub))) return;
  const rows = await s.store.sql.query(sql<{ email_forwarding: unknown }>`
    SELECT email_forwarding FROM idp_accounts
    WHERE provider = 'apple' AND provider_user_id = ${sub}
  `);
  const stored = rows[0]?.email_forwarding;
  const on =
    stored === true || stored === 1 || stored === '1' || stored === 't';
  if (on !== forwarding) {
    violate(s, `relay forwarding for ${email}: stored ${String(stored)}`);
  }
}

/** The address a Google account moves to when its holder changes it. */
export function movedGoogleEmail(email: string): string {
  const at = email.indexOf('@');
  return `${email.slice(0, at)}.moved${email.slice(at)}`;
}

/** The holder changes their Google address; the subject stays. */
export async function googleEmailChangedFlow(
  s: AuthSurface,
  email: string
): Promise<void> {
  const store = s.store.idps.google.ctx.store;
  const account = await store.accountByEmail(email);
  if (account === null) return;
  const at = email.indexOf('@');
  const moved = movedGoogleEmail(email);
  await store.upsertAccount({
    sub: account.sub,
    handle: email.slice(0, at),
    email: moved,
    emailVerified: account.emailVerified,
    hd: account.hd,
  });
  s.directory.google = s.directory.google.map((entry) =>
    entry === email ? moved : entry
  );
}

export async function setFaultsFlow(
  s: AuthSurface,
  provider: OauthProviderId,
  patch: Partial<IdpFaults> | null
): Promise<void> {
  const store = s.store.idps[provider].ctx.store;
  await store.setFaults(
    patch === null
      ? IDP_DEFAULT_FAULTS
      : { ...(await store.faults()), ...patch }
  );
}

export async function rotateKeysFlow(
  s: AuthSurface,
  provider: OauthProviderId
): Promise<void> {
  await s.store.idps[provider].ctx.store.rotateSigningKeys();
}
