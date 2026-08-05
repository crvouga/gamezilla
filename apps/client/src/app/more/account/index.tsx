/**
 * Account settings route: profile identity + account management.
 */

import { AccountScreen } from '@libs/auth/client/account-screen';
import { useAuthClientPort } from '@libs/auth/client/auth-client-provider';
import { useIsSignedIn } from '@libs/auth/client/use-current-user';
import { DeviceAvatar } from '@libs/profile/client/device-avatar';
import { MyProfileAvatar } from '@libs/profile/client/my-profile-avatar';
import { useMyProfileId } from '@libs/profile/client/use-my-profile-id';
import { useProfileColumn } from '@libs/profile/client/use-profile-column';
import type { LocalizedString } from '@pkgs/i18n';
import { useSyncEnginePaintReady } from '@pkgs/sync-engine/client/sync-engine-paint-gate';
import { MenuList, MenuRow } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useMemo, type ReactNode } from 'react';

const IDENTITY_AVATAR_SIZE = 40;

function useReadyProfileUsername(): string | null {
  const isSignedIn = useIsSignedIn();
  const paintReady = useSyncEnginePaintReady();
  const profileId = useMyProfileId();
  const watchId =
    isSignedIn && paintReady && profileId !== null ? profileId : '';
  return useProfileColumn(watchId, 'username');
}

function AccountIdentityLeading({
  isSignedIn,
}: {
  isSignedIn: boolean;
}): ReactNode {
  if (!isSignedIn) {
    return (
      <DeviceAvatar
        avatarConfig={null}
        seedFallback="signed-out"
        size={IDENTITY_AVATAR_SIZE}
      />
    );
  }
  return <MyProfileAvatar size={IDENTITY_AVATAR_SIZE} />;
}

function nonEmpty(value: string | null): string | null {
  return value !== null && value.length > 0 ? value : null;
}

function resolveSignedInIdentityTitle(
  username: string | null,
  email: string | null,
  accountLabel: LocalizedString
): string {
  return nonEmpty(username) ?? nonEmpty(email) ?? accountLabel;
}

function resolveAccountIdentity(args: {
  readonly isSignedIn: boolean;
  readonly username: string | null;
  readonly email: string | null;
  readonly accountLabel: LocalizedString;
}): { title: string; caption: string | undefined } | null {
  const { isSignedIn, username, email, accountLabel } = args;
  const emailText = nonEmpty(email);
  if (!isSignedIn) {
    return emailText === null ? null : { title: emailText, caption: undefined };
  }
  const title = resolveSignedInIdentityTitle(username, email, accountLabel);
  const caption =
    emailText !== null && emailText !== title ? emailText : undefined;
  return { title, caption };
}

function AccountIdentityBlock(): ReactNode {
  const { t } = useLingui();
  const isSignedIn = useIsSignedIn();
  const username = useReadyProfileUsername();
  const port = useAuthClientPort();
  const email = port.useAuthSession().session?.email ?? null;
  const accountLabel = t`Account`;

  const identity = useMemo(
    () =>
      resolveAccountIdentity({
        isSignedIn,
        username,
        email,
        accountLabel,
      }),
    [isSignedIn, username, email, accountLabel]
  );

  if (identity === null) return null;

  return (
    <MenuList>
      <MenuRow
        title={identity.title}
        {...(identity.caption !== undefined
          ? { caption: identity.caption }
          : {})}
        leading={<AccountIdentityLeading isSignedIn={isSignedIn} />}
        hideChevron
      />
    </MenuList>
  );
}

export default function AccountRoute(): ReactNode {
  return <AccountScreen identity={<AccountIdentityBlock />} />;
}
