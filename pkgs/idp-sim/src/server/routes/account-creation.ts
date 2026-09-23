/** Validating an account submission — the create screen and the test admin. */

import { IDP_BRAND } from '../../shared/brand';
import type { IdpAccountDraft } from '../../shared/types';

/** The exact shape the create screen produces — email and name are required. */
export type CreateAccountDraft = IdpAccountDraft & {
  readonly email: string;
  readonly name: string;
  readonly givenName: string;
};

export type AccountDraftResult =
  | { readonly ok: true; readonly draft: CreateAccountDraft }
  | { readonly ok: false; readonly error: string };

export type AdminDraftResult =
  | { readonly ok: true; readonly draft: IdpAccountDraft }
  | { readonly ok: false; readonly error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 80;

export const DUPLICATE_EMAIL_ERROR =
  'That email address is already in use. Sign in with it instead.';

/** Normalize + validate the two fields the create screen collects. */
export function parseAccountDraft(input: {
  readonly email: string;
  readonly name: string;
}): AccountDraftResult {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (email.length === 0) {
    return { ok: false, error: 'Enter an email address for the account.' };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return {
      ok: false,
      error: `That email address isn't a valid ${IDP_BRAND.name} account name.`,
    };
  }
  if (name.length === 0) {
    return { ok: false, error: 'Enter the name for this account.' };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      error: `That name is too long for an ${IDP_BRAND.name} account.`,
    };
  }
  const parts = name.split(' ');
  const givenName = parts[0] ?? name;
  const familyName = parts.slice(1).join(' ');
  return {
    ok: true,
    draft: {
      email,
      name,
      givenName,
      ...(familyName.length > 0 ? { familyName } : {}),
    },
  };
}

/**
 * The test admin posts raw drafts (`{ handle: 'carol' }` is the common case),
 * so it validates whatever identity it was given with the same rules.
 */
export function parseAdminAccountDraft(raw: IdpAccountDraft): AdminDraftResult {
  if (raw.email !== undefined) {
    const parsed = parseAccountDraft({
      email: raw.email,
      name: raw.name ?? raw.email,
    });
    // Keep what the admin pinned (`sub`, `hd`, `emailVerified`, …): changing
    // an existing account's address is `{ sub, email }`.
    return parsed.ok
      ? { ok: true, draft: { ...raw, ...parsed.draft } }
      : parsed;
  }
  if (raw.handle === undefined || raw.handle.trim().length === 0) {
    return { ok: false, error: 'Account draft needs an email or a handle.' };
  }
  return { ok: true, draft: raw };
}
