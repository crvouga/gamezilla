import { Handles } from '@libs/test-ids';
import { Trans, useLingui } from '@lingui/react/macro';
import { useSyncEngine } from '@pkgs/sync-engine/client';
import {
  Box,
  Button,
  Island,
  IslandGrid,
  ScreenBase,
  ScreenBodyScrollView,
  useRouter,
} from '@pkgs/ui-rn';
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
      surface="canvas"
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
    <IslandGrid columns={3}>
      <Island span={1}>
        <Box
          sx={{
            alignItems: 'center',
            gap: 3,
            pt: 2,
          }}
        >
          <MyProfileAvatar size={96} />
          <Box
            sx={{
              alignItems: 'center',
              gap: 1,
              alignSelf: 'stretch',
              minWidth: 0,
            }}
          >
            <MyUsername
              variant="heading"
              numberOfLines={1}
              sx={{ textAlign: 'center' }}
            />
          </Box>
          <Box
            sx={{ flexDirection: 'row', gap: 2, alignSelf: 'stretch', mt: 2 }}
          >
            <Button
              title={t`Edit profile`}
              intent="neutral"
              variant="outline"
              flex={1}
              onPress={() => router.push('/profile/edit')}
              testID={Handles.profileEdit}
            />
          </Box>
        </Box>
      </Island>
      <Island span={2} title={<Trans>Friends</Trans>}>
        <Box sx={{ gap: 3, alignSelf: 'stretch' }}>
          {friendsStats !== undefined && friendsStats !== null
            ? friendsStats
            : null}
          {friendsActions !== undefined && friendsActions !== null ? (
            <Box sx={{ flexDirection: 'row', gap: 2 }}>{friendsActions}</Box>
          ) : null}
        </Box>
      </Island>
    </IslandGrid>
  );
}
