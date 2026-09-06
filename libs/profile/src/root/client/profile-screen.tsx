import { Handles } from '@libs/test-ids';
import { Trans, useLingui } from '@lingui/solid/macro';
import {
  Box,
  Button,
  Island,
  IslandGrid,
  ScreenBase,
  ScreenBodyScrollView,
  useRouter,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { MyProfileAvatar } from './my-profile-avatar';
import { MyUsername } from './my-username';

export type ProfileScreenProps = {
  /** Centered friends stats row (signed-in counts; guests open sign-in on tap). */
  readonly friendsStats?: JSX.Element | undefined;
  /** Second action pill beside Edit profile (e.g. Find friends). */
  readonly friendsActions?: JSX.Element | undefined;
  /** Extra bottom inset for content padding. */
  readonly bottomInset?: number | undefined;
};

export function ProfileScreen(props: ProfileScreenProps): JSX.Element {
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
            props.bottomInset !== undefined && props.bottomInset > 0
              ? { paddingBottom: props.bottomInset }
              : false,
          ]}
        >
          <ProfileScreenContent
            friendsStats={props.friendsStats}
            friendsActions={props.friendsActions}
          />
        </ScreenBodyScrollView>
      )}
    />
  );
}

function ProfileScreenContent(props: {
  readonly friendsStats?: JSX.Element | undefined;
  readonly friendsActions?: JSX.Element | undefined;
}): JSX.Element {
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
              onClick={() => router.push('/profile/edit')}
              dataSet={{ testid: Handles.profileEdit }}
            />
          </Box>
        </Box>
      </Island>
      <Island span={2} title={<Trans>Friends</Trans>}>
        <Box sx={{ gap: 3, alignSelf: 'stretch' }}>
          {props.friendsStats !== undefined && props.friendsStats !== null
            ? props.friendsStats
            : null}
          {props.friendsActions !== undefined &&
          props.friendsActions !== null ? (
            <Box sx={{ flexDirection: 'row', gap: 2 }}>
              {props.friendsActions}
            </Box>
          ) : null}
        </Box>
      </Island>
    </IslandGrid>
  );
}
