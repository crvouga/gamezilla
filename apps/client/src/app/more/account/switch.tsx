import { AccountSwitcherScreen } from '@libs/auth/client/account-switcher/account-switcher-screen';
import type { LocalAccount } from '@libs/auth/client/use-local-accounts';
import type { ReactNode } from 'react';

import { LocalAccountAvatar } from '../../../ui/local-account-avatar';

function renderAvatar(account: LocalAccount, size: number): ReactNode {
  return <LocalAccountAvatar account={account} size={size} />;
}

export default function AccountSwitchRoute(): ReactNode {
  return <AccountSwitcherScreen renderAvatar={renderAvatar} />;
}
