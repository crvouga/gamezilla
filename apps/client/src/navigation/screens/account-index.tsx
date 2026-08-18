/**
 * Account settings route: profile identity + account management.
 */

import {
  useIsAnon,
  useSessionAccountEmail,
} from '@libs/auth/public/use-current-user';
import { AccountScreen } from '@libs/auth/root/client/account-screen';
import { useMyProfileId } from '@libs/profile/public/use-my-profile-id';
import { useProfileColumn } from '@libs/profile/public/use-profile-column';
import { MyProfileAvatar } from '@libs/profile/root/client/my-profile-avatar';
import { useLingui } from '@lingui/react/macro';
import type { LocalizedString } from '@pkgs/i18n';
import { useSyncEngine } from '@pkgs/sync-engine/client';
import { MenuList, MenuRow } from '@pkgs/ui';
import { type ReactNode, useMemo } from 'react';

const IDENTITY_AVATAR_SIZE = 40;

function useReadyProfileUsername(): string | null {
  const { paintReady } = useSyncEngine();
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
  const sessionEmail = useSessionAccountEmail();
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
