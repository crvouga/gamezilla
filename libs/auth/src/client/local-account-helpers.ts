import { asLocalized, type LocalizedString } from '@pkgs/i18n';

import type { LocalAccount } from './use-local-accounts';

export function localAccountSubtitle(
  account: LocalAccount
): string | undefined {
  if (account.email !== null && account.email.length > 0) {
    return account.email;
  }
  return undefined;
}

export function localAccountAccessibilityLabel(
  title: string,
  subtitle: string | undefined
): LocalizedString {
  if (subtitle === undefined) return asLocalized(title);
  return asLocalized(`${title}, ${subtitle}`);
}

/** Active account from the same merge path as switcher / menu rows. */
export function findActiveLocalAccount(
  accounts: readonly LocalAccount[]
): LocalAccount | undefined {
  return accounts.find((account) => account.isActive);
}
