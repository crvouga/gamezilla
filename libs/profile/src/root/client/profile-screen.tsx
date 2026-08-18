import { Handles } from '@libs/dst-handles';
import { Trans, useLingui } from '@lingui/react/macro';
import { useSyncEngine } from '@pkgs/sync-engine/client';
import {
  Box,
  Button,
  ScreenBase,
  ScreenBodyScrollView,
  useRouter,
} from '@pkgs/ui';
import type { ReactNode } from 'react';
import { MyProfileAvatar } from './my-profile-avatar';
import { MyUsername } from './my-username';

export type ProfileScreenProps = {
  /** Centered friends stats row (signed-in counts; guests open sign-in on tap). */
  readonly friendsStats?: ReactNode;
  /** Second action pill beside Edit profile (e.g. Find friends). */
  readonly friendsActions?: ReactNode;
  /** Extra bottom inset for content padding. */
  readonly bottomInset?: number;
};

export function ProfileScreen({
  friendsStats,
  friendsActions,
  bottomInset = 0,
}: ProfileScreenProps) {
  const { refreshQueries } = useSyncEngine();
  return (
    <ScreenBase
      screenId="profile"
      breadcrumbs={[{ name: <Trans>Profile</Trans> }]}
      content={({ sx }) => (
        <ScreenBodyScrollView
          frameSx={sx}
          sx={[
            { flexGrow: 1 },
            bottomInset > 0 ? { paddingBottom: bottomInset } : false,
          ]}
          onRefresh={() => refreshQueries()}
        >
          <ProfileScreenContent
            friendsStats={friendsStats}
            friendsActions={friendsActions}
          />
        </ScreenBodyScrollView>
      )}
    />
  );
}

function ProfileScreenContent({
  friendsStats,
  friendsActions,
}: {
  friendsStats?: ReactNode;
  friendsActions?: ReactNode;
}): ReactNode {
  const { t } = useLingui();
  const router = useRouter();

  return (
    <Box
      sx={{
        alignItems: 'center',
        gap: 3,
        pt: 2,
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
          testID={Handles.profileEdit}
        />
        {friendsActions}
      </Box>
    </Box>
  );
}
