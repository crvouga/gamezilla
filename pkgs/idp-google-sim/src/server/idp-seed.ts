/** Helpers for populating the IdP's internal directory. */

import type { IdpAccount, IdpClient } from '../shared/types';
import type { IdpState } from './idp-state';

export type IdpAccountDraft = {
  /** Local part of the address and the display-name source, e.g. `alice`. */
  readonly handle: string;
  readonly sub?: string;
  readonly email?: string;
  readonly name?: string;
  readonly givenName?: string;
  readonly familyName?: string;
  readonly picture?: string;
  readonly hd?: string | null;
  readonly password?: string;
  readonly emailVerified?: boolean;
};

const DEFAULT_PASSWORD = 'hunter2-hunter2';

function titleCase(raw: string): string {
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Google `sub`s are 21-digit decimal strings. Derive one from the handle so a
 * given account is the same subject on every boot of the stack.
 */
function derivedSub(handle: string): string {
  let hash = 0n;
  for (const char of handle) {
    hash = (hash * 131n + BigInt(char.codePointAt(0) ?? 0)) % 10n ** 20n;
  }
  return `1${hash.toString().padStart(20, '0')}`;
}

export function buildAccount(draft: IdpAccountDraft): IdpAccount {
  const handle = draft.handle.trim().toLowerCase();
  const given = draft.givenName ?? titleCase(handle);
  const family = draft.familyName ?? 'Tester';
  return {
    sub: draft.sub ?? derivedSub(handle),
    email: draft.email ?? `${handle}@gmail.com`,
    emailVerified: draft.emailVerified ?? true,
    name: draft.name ?? `${given} ${family}`,
    givenName: given,
    familyName: family,
    picture:
      draft.picture ?? `https://lh3.googleusercontent.com/a/${handle}=s96-c`,
    hd: draft.hd ?? null,
    password: draft.password ?? DEFAULT_PASSWORD,
  };
}

export function upsertAccount(
  state: IdpState,
  draft: IdpAccountDraft
): IdpAccount {
  const account = buildAccount(draft);
  state.accounts.set(account.sub, account);
  return account;
}

export function registerClient(state: IdpState, client: IdpClient): IdpClient {
  state.clients.set(client.clientId, client);
  return client;
}

/** Forget every browser session, grant, code and token; keep the directory. */
export function resetRuntimeState(state: IdpState): void {
  state.sessions.clear();
  state.authRequests.clear();
  state.authCodes.clear();
  state.accessTokens.clear();
  state.refreshTokens.clear();
  state.grants.clear();
}
