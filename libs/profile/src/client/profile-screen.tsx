import { MyDisplayName } from './my-display-name';
import { MyProfileAvatar } from './my-profile-avatar';
import { useMyProfileId } from './use-my-profile-id';
import { useProfileColumn, ProfileField } from './use-profile-column';
import {
  Box,
  Button,
  ScreenBase,
  Text,
  useBreakpoint,
  type ScreenBaseAction,
} from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';

export type ProfileScreenProps = {
  /** Header overflow actions for user / connection / settings on mobile. */
  readonly accountActions: readonly ScreenBaseAction[];
  /** Desktop centered tab strip (top-level tab navigation). */
  readonly centerTabs?: ReactNode;
  /** Desktop trailing slot (account avatar trigger). */
  readonly headerEnd?: ReactNode;
  /** Leading slot (typically the app logo on root tabs). */
  readonly leading?: ReactNode;
  /** Centered friends stats row (signed-in counts; guests open sign-in on tap). */
  readonly friendsStats?: ReactNode;
  /** Second action pill beside Edit profile (e.g. Find friends). */
  readonly friendsActions?: ReactNode;
  /** Bottom inset to add to content padding (e.g., for space miniplayer height).
   * Use {@link useSpaceMiniplayerLayoutInsets} from @libs/spaces when
   * rendering inside a space context, or pass 0 otherwise. */
  readonly bottomInset?: number;
};

export function ProfileScreen({
  accountActions,
  centerTabs,
  headerEnd,
  leading,
  friendsStats,
  friendsActions,
  bottomInset = 0,
}: ProfileScreenProps) {
  const isMobile = useBreakpoint() === 'mobile';

  return (
    <ScreenBase
      breadcrumbs={[{ name: <Trans>Profile</Trans> }]}
      actions={isMobile ? [...accountActions] : []}
      centerTabs={centerTabs}
      headerEnd={headerEnd}
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
  const profileId = useMyProfileId();
  const username = useProfileColumn(profileId ?? '', ProfileField.username);

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
        <MyDisplayName variant="title" sx={{ textAlign: 'center' }} />
        {profileId !== null && username !== null && username.length > 0 ? (
          <Text
            variant="body"
            sx={{ color: 'textSecondary', textAlign: 'center' }}
            label={`@${username}`}
          />
        ) : null}
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
