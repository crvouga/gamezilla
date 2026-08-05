/**
 * Account settings route: profile identity + account management.
 */

import { AccountScreen } from '@libs/auth/client/account-screen';
import { useAuthClientPort } from '@libs/auth/client/auth-client-provider';
import { useIsSignedIn } from '@libs/auth/client/use-current-user';
import { MyProfileAvatar } from '@libs/profile/client/my-profile-avatar';
import { useMyProfileId } from '@libs/profile/client/use-my-profile-id';
import { useProfileColumn } from '@libs/profile/client/use-profile-column';
import { MenuList, MenuRow } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useMemo, type ReactNode } from 'react';

const IDENTITY_AVATAR_SIZE = 40;

function AccountIdentityBlock(): ReactNode {
  const { t } = useLingui();
  const isSignedIn = useIsSignedIn();
  const profileId = useMyProfileId();
  const username = useProfileColumn(profileId ?? '', 'username');
  const port = useAuthClientPort();
  const authState = port.useAuthSession();
  const email = authState.session?.email ?? null;

  const identity = useMemo(() => {
    if (!isSignedIn) return null;
    const title =
      username !== null && username.length > 0
        ? username
        : email !== null && email.length > 0
          ? email
          : t`Account`;
    return {
      title,
      caption:
        email !== null && email.length > 0 && email !== title
          ? email
          : undefined,
    };
  }, [isSignedIn, username, email, t]);

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
