import { Trans, useLingui } from '@lingui/react/macro';
import { Box, Button, ScreenBase } from '@pkgs/ui';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { MyProfileAvatar } from './my-profile-avatar';
import { MyUsername } from './my-username';

export type ProfileScreenProps = {
  /** Always-visible account avatar menu in the header trailing slot. */
  readonly accountMenu?: ReactNode;
  /** Leading slot (typically the app logo on root tabs). */
  readonly leading?: ReactNode;
  /** Centered friends stats row (signed-in counts; guests open sign-in on tap). */
  readonly friendsStats?: ReactNode;
  /** Second action pill beside Edit profile (e.g. Find friends). */
  readonly friendsActions?: ReactNode;
  /** Extra bottom inset for content padding. */
  readonly bottomInset?: number;
};

export function ProfileScreen({
  accountMenu,
  leading,
  friendsStats,
  friendsActions,
  bottomInset = 0,
}: ProfileScreenProps) {
  return (
    <ScreenBase
      screenId="profile"
      breadcrumbs={[{ name: <Trans>Profile</Trans> }]}
      accountMenu={accountMenu}
      leading={leading}
      content={({ sx }) => (
        <ProfileScreenContent
          sx={sx}
          bottomInset={bottomInset}
          friendsStats={friendsStats}
          friendsActions={friendsActions}
        />
      )}
    />
  );
}

function ProfileScreenContent({
  sx,
  bottomInset,
  friendsStats,
  friendsActions,
}: {
  sx: Record<string, unknown>;
  bottomInset: number;
  friendsStats?: ReactNode;
  friendsActions?: ReactNode;
}): ReactNode {
  const { t } = useLingui();
  const router = useRouter();

  return (
    <Box
      style={{
        ...sx,
        ...(bottomInset > 0 ? { paddingBottom: bottomInset } : {}),
        alignItems: 'center',
        gap: 12,
        paddingTop: 8,
      }}
    >
      <MyProfileAvatar size={96} />
      <Box sx={{ alignItems: 'center', gap: 1, alignSelf: 'stretch' }}>
        <MyUsername variant="title" sx={{ textAlign: 'center' }} />
      </Box>
      {friendsStats !== undefined && friendsStats !== null ? (
        <Box sx={{ alignSelf: 'stretch', mt: 4 }}>{friendsStats}</Box>
      ) : null}
      <Box sx={{ flexDirection: 'row', gap: 2, alignSelf: 'stretch', mt: 4 }}>
        <Button
          title={t`Edit profile`}
          intent="neutral"
          variant="outline"
          flex={1}
          onPress={() => router.push('/profile/edit')}
        />
        {friendsActions}
      </Box>
    </Box>
  );
}
