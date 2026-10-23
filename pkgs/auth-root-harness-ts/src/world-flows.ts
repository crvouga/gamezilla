/**
 * The world changing under the app: account holders acting at their
 * provider (revoking the app, deleting the account, switching relay
 * forwarding, changing their address), providers misbehaving, keys rotating.
 */

import type { OauthProviderId } from '@pkgs/auth-root-shared-ts/sign-in-method';
import sql from '@pkgs/sql-root-shared-ts/sql';

import { violate } from './checks';
import { endUserSessions, identitiesOf, identityKey } from './model';
import type { ProviderFaults } from './providers';
import { accountAt, NO_PROVIDER_FAULTS } from './providers';
import { APPLE_CLIENT_ID } from './relying-party';
import type { AuthSurface } from './types';
import { grantOf } from './world';

/** Apple's test-only control plane (`/__admin`). */
async function appleAdmin(
  s: AuthSurface,
  path: string,
  body: unknown
): Promise<void> {
  const apple = s.store.idps.apple;
  const response = await apple.fetch(
    new Request(`${apple.origin}/__admin${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
  if (!response.ok) {
    throw new Error(
      `apple ${path} → ${String(response.status)}: ${await response.text()}`
    );
  }
}

/** The Apple account at `email`, the subject the app knows it by, and its grant. */
async function appleAccount(s: AuthSurface, email: string) {
  const account = accountAt(s.store.idps.apple, email);
  if (account === null) return null;
  const grant = await grantOf(s.store.idps.apple, 'apple', account.id);
  return { id: account.id, sub: grant.subject, granted: grant.granted };
}

/**
 * "Stop using Apple Account" with this app: Apple tells an app it had
 * authorized, and every session of the identity's owner ends.
 */
export async function appleConsentRevokedFlow(
  s: AuthSurface,
  email: string
): Promise<void> {
  const account = await appleAccount(s, email);
  if (account === null) return;
  await appleAdmin(s, '/consents/revoke', {
    clientId: APPLE_CLIENT_ID,
    accountId: account.id,
  });
  const owner = s.model.identities.get(identityKey('apple', account.sub));
  if (account.granted && owner !== undefined) {
    endUserSessions(s.model, owner.userId);
  }
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
  const account = await appleAccount(s, email);
  if (account === null) return;
  await appleAdmin(s, '/accounts/delete', { accountId: account.id });
  s.directory.apple = s.directory.apple.filter((entry) => entry !== email);
  const key = identityKey('apple', account.sub);
  const owner = s.model.identities.get(key);
  if (!account.granted || owner === undefined) return;
  s.model.identities.delete(key);
  if (identitiesOf(s.model, owner.userId).length === 0) {
    endUserSessions(s.model, owner.userId);
  }
}

/** Hide My Email forwarding turned off or on: only a relay address is told. */
export async function appleRelayForwardingFlow(
  s: AuthSurface,
  email: string,
  forwarding: boolean
): Promise<void> {
  const account = await appleAccount(s, email);
  if (account === null) return;
  await appleAdmin(s, '/relay-forwarding', {
    accountId: account.id,
    forwarding,
  });
  const identity = s.model.identities.get(identityKey('apple', account.sub));
  if (identity === undefined || !identity.isPrivate) return;
  const rows = await s.store.sql.query(sql<{ email_forwarding: unknown }>`
    SELECT email_forwarding FROM idp_accounts
    WHERE provider = 'apple' AND provider_user_id = ${account.sub}
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
export function googleEmailChangedFlow(s: AuthSurface, email: string): void {
  const google = s.store.idps.google;
  const account = accountAt(google, email);
  if (account === null) return;
  const moved = movedGoogleEmail(email);
  google.runtime.instance().seedAccount({ ...account, email: moved });
  s.directory.google = s.directory.google.map((entry) =>
    entry === email ? moved : entry
  );
}

export function setFaultsFlow(
  s: AuthSurface,
  provider: OauthProviderId,
  patch: Partial<ProviderFaults> | null
): void {
  const idp = s.store.idps[provider];
  idp.setFaults(
    patch === null ? NO_PROVIDER_FAULTS : { ...idp.faults(), ...patch }
  );
}

export function rotateKeysFlow(
  s: AuthSurface,
  provider: OauthProviderId
): void {
  s.store.idps[provider].runtime.instance().rotateSigningKey(true);
}
