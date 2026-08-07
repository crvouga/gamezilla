/**
 * Account settings route: profile identity + account management.
 */

import { AccountScreen } from '@libs/auth/client/account-screen';
import { useAuthClientPort } from '@libs/auth/client/auth-client-provider';
import { useIsAnon } from '@libs/auth/client/use-current-user';
import { MyProfileAvatar } from '@libs/profile/client/my-profile-avatar';
import { useMyProfileId } from '@libs/profile/client/use-my-profile-id';
import { useProfileColumn } from '@libs/profile/client/use-profile-column';
import { useLingui } from '@lingui/react/macro';
import type { LocalizedString } from '@pkgs/i18n';
import { useSyncEnginePaintReady } from '@pkgs/sync-engine/client/sync-engine-paint-gate';
import { MenuList, MenuRow } from '@pkgs/ui';
import { type ReactNode, useMemo } from 'react';

const IDENTITY_AVATAR_SIZE = 40;

function useReadyProfileUsername(): string | null {
  const paintReady = useSyncEnginePaintReady();
  const profileId = useMyProfileId();
  const watchId = paintReady && profileId !== null ? profileId : '';
  return useProfileColumn(watchId, 'username');
}

function nonEmpty(value: string | null): string | null {
  return value !== null && value.length > 0 ? value : null;
}

function resolveAccountIdentity(args: {
  readonly username: string | null;
  readonly email: string | null;
  readonly accountLabel: LocalizedString;
}): { title: string; caption: string | undefined } {
  const { username, email, accountLabel } = args;
  const emailText = nonEmpty(email);
  const title = nonEmpty(username) ?? emailText ?? accountLabel;
  const caption =
    emailText !== null && emailText !== title ? emailText : undefined;
  return { title, caption };
}

function AccountIdentityBlock(): ReactNode {
  const { t } = useLingui();
  const isAnon = useIsAnon();
  const username = useReadyProfileUsername();
  const port = useAuthClientPort();
  const sessionEmail = port.useAuthSession().session?.email ?? null;
  const email = isAnon ? null : sessionEmail;
  const accountLabel = t`Account`;

  const identity = useMemo(
    () =>
      resolveAccountIdentity({
        username,
        email,
        accountLabel,
      }),
    [username, email, accountLabel]
  );

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
