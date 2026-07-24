/**
 * Account settings route: profile identity + account management.
 */

import { AccountScreen } from '@libs/auth/client/account-screen';
import {
  accountDisplayTitle,
  useLocalAccounts,
} from '@libs/auth/client/use-local-accounts';
import { MyProfileAvatar } from '@libs/profile/client/my-profile-avatar';
import { MenuList, MenuRow } from '@pkgs/ui';
import { useMemo, type ReactNode } from 'react';

const IDENTITY_AVATAR_SIZE = 40;

function AccountIdentityBlock(): ReactNode {
  const accounts = useLocalAccounts();
  const identity = useMemo(() => {
    const active = accounts.find((account) => account.isActive);
    if (active === undefined) return null;
    const email = active.email;
    return {
      title: accountDisplayTitle(active),
      caption: email !== null && email.length > 0 ? email : undefined,
    };
  }, [accounts]);

  if (identity === null) return null;

  return (
    <MenuList>
      <MenuRow
        title={identity.title}
        {...(identity.caption !== undefined
          ? { caption: identity.caption }
          : {})}
        leading={<MyProfileAvatar size={IDENTITY_AVATAR_SIZE} />}
        hideChevron
      />
    </MenuList>
  );
}

export default function AccountRoute(): ReactNode {
  return <AccountScreen identity={<AccountIdentityBlock />} />;
}
