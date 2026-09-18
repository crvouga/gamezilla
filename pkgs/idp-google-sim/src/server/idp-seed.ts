/**
 * Deriving a directory entry from a draft. Pure — no storage, no I/O.
 *
 * `sub` is derived from the normalized address rather than from the local
 * part, so two accounts can never collide on a subject: the same `alice`
 * at two domains is two accounts.
 */

import type { IdpAccount, IdpAccountDraft } from '../shared/types';

const DEFAULT_FAMILY_NAME = 'Tester';
const DEFAULT_EMAIL_DOMAIN = 'gmail.com';

/**
 * Accounts every local IdP starts with: the alphabet, so a chooser has a list
 * worth scrolling and picking from.
 */
export const DEFAULT_IDP_ACCOUNTS: readonly IdpAccountDraft[] = [
  { handle: 'alice' },
  { handle: 'bob' },
  { handle: 'chris' },
  { handle: 'dan' },
  { handle: 'ed' },
  { handle: 'fred' },
];

function titleCase(raw: string): string {
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Google `sub`s are 21-digit decimal strings. Derive one from the address so
 * a given account is the same subject on every boot of the stack.
 */
function derivedSub(seed: string): string {
  let hash = 0n;
  for (const char of seed) {
    hash = (hash * 131n + BigInt(char.codePointAt(0) ?? 0)) % 10n ** 20n;
  }
  return `1${hash.toString().padStart(20, '0')}`;
}

function resolveEmail(draft: IdpAccountDraft): string {
  if (draft.email !== undefined) return draft.email.trim().toLowerCase();
  if (draft.handle !== undefined) {
    return `${draft.handle.trim().toLowerCase()}@${DEFAULT_EMAIL_DOMAIN}`;
  }
  throw new Error('IdP account draft needs an email or a handle');
}

export function buildAccount(draft: IdpAccountDraft): IdpAccount {
  const email = resolveEmail(draft);
  const handle =
    draft.handle?.trim().toLowerCase() ?? email.split('@')[0] ?? '';
  const given = draft.givenName ?? titleCase(handle);
  const family = draft.familyName ?? DEFAULT_FAMILY_NAME;
  return {
    sub: draft.sub ?? derivedSub(email),
    email,
    emailVerified: draft.emailVerified ?? true,
    name: draft.name ?? `${given} ${family}`,
    givenName: given,
    familyName: family,
    picture:
      draft.picture ?? `https://lh3.googleusercontent.com/a/${handle}=s96-c`,
    hd: draft.hd ?? null,
  };
}
