/**
 * Deriving a directory entry from a draft. Pure — no storage, no I/O.
 *
 * `sub` is derived from the normalized address rather than from the local
 * part, so two accounts can never collide on a subject: the same `alice`
 * at two domains is two accounts. The shape of the subject and the defaults
 * (domain, picture) follow the provider the directory belongs to.
 */

import { subOfProvider } from '../shared/sub';
import type {
  IdpAccount,
  IdpAccountDraft,
  IdpProviderKind,
} from '../shared/types';

const DEFAULT_FAMILY_NAME = 'Tester';
const DEFAULT_EMAIL_DOMAIN: Record<IdpProviderKind, string> = {
  google: 'gmail.com',
  apple: 'icloud.com',
};

/**
 * Accounts every local Google-flavored IdP starts with: the alphabet, so a
 * chooser has a list worth scrolling and picking from, plus the two Google
 * shapes relying parties get wrong — a Workspace account (`hd`) and an
 * account whose address Google never verified.
 */
export const DEFAULT_GOOGLE_ACCOUNTS: readonly IdpAccountDraft[] = [
  { handle: 'alice' },
  { handle: 'bob' },
  { handle: 'chris' },
  { handle: 'dan' },
  { handle: 'ed' },
  { handle: 'fred' },
  { handle: 'wendy', email: 'wendy@workspace.test', hd: 'workspace.test' },
  { handle: 'uma', email: 'uma@unverified.test', emailVerified: false },
];

/**
 * Accounts every local Apple-flavored IdP starts with. `alice` and `bob` use
 * iCloud addresses; `chris` is an Apple Account registered with a Gmail
 * address — the same person as Google's `chris@gmail.com`, which is the case
 * account linking by email exists for.
 */
export const DEFAULT_APPLE_ACCOUNTS: readonly IdpAccountDraft[] = [
  { handle: 'alice' },
  { handle: 'bob' },
  { handle: 'chris', email: 'chris@gmail.com' },
  { handle: 'dan', realUserStatus: 2 },
];

export function defaultAccountsFor(
  provider: IdpProviderKind
): readonly IdpAccountDraft[] {
  return provider === 'apple'
    ? DEFAULT_APPLE_ACCOUNTS
    : DEFAULT_GOOGLE_ACCOUNTS;
}

function titleCase(raw: string): string {
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function resolveEmail(
  provider: IdpProviderKind,
  draft: IdpAccountDraft
): string {
  if (draft.email !== undefined) return draft.email.trim().toLowerCase();
  if (draft.handle !== undefined) {
    return `${draft.handle.trim().toLowerCase()}@${DEFAULT_EMAIL_DOMAIN[provider]}`;
  }
  throw new Error('IdP account draft needs an email or a handle');
}

function defaultPicture(provider: IdpProviderKind, handle: string): string {
  if (provider === 'apple') return '';
  return `https://lh3.googleusercontent.com/a/${handle}=s96-c`;
}

export function buildAccount(
  provider: IdpProviderKind,
  draft: IdpAccountDraft
): IdpAccount {
  const email = resolveEmail(provider, draft);
  const handle =
    draft.handle?.trim().toLowerCase() ?? email.split('@')[0] ?? '';
  const given = draft.givenName ?? titleCase(handle);
  const family = draft.familyName ?? DEFAULT_FAMILY_NAME;
  return {
    sub: draft.sub ?? subOfProvider(provider, email),
    email,
    emailVerified: draft.emailVerified ?? true,
    name: draft.name ?? `${given} ${family}`,
    givenName: given,
    familyName: family,
    picture: draft.picture ?? defaultPicture(provider, handle),
    hd: draft.hd ?? null,
    realUserStatus: draft.realUserStatus ?? 1,
  };
}
