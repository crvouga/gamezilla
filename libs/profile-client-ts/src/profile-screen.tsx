import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { ProfileScreenLayout } from '@pkgs/ui-root-client-ts/profile-screen-layout';
import { Skeleton } from '@pkgs/ui-root-client-ts/skeleton';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import { Match, Switch } from 'solid-js';
import { AvatarRefusedChangeNotice } from './avatar-refused-change-notice';
import { useProfileRow } from './claim-username-use-profile-row';
import { MyProfileAvatar } from './my-profile-avatar';
import { MyUsername } from './my-username';
import { ProfileAvatarFigure } from './profile-avatar-figure';
import { useMyProfileId } from './public-use-my-profile-id';
import { StandInNotice } from './stand-in-notice';
import { useFirstSyncError } from './use-first-sync-error';
import { UsernameChangeFeedback } from './username-change-feedback';

export type ProfileScreenProps = {
  /** Centered friends stats row (signed-in counts; guests open sign-in on tap). */
  readonly friendsStats?: JSX.Element | undefined;
  /** Second action pill beside Edit profile (e.g. Find friends). */
  readonly friendsActions?: JSX.Element | undefined;
};

/** The name under the avatar: a placeholder while loading, an explanation when it cannot arrive. */
function ProfileName(): JSX.Element {
  const engine = useSyncEngine();
  const { row, isLoading } = useProfileRow(useMyProfileId());
  const firstSyncError = useFirstSyncError();
  return (
    <Switch
      fallback={
        <MyUsername variant="heading" numberOfLines={1} align="center" />
      }
    >
      <Match when={!engine.paintReady() || (isLoading() && row() === null)}>
        <Skeleton width="40%" height={28} />
      </Match>
      <Match when={row() === null && firstSyncError()}>
        <ErrorState
          variant="compact"
          title={<Trans>Your profile could not be loaded</Trans>}
          body={<Trans>Check your connection and try again.</Trans>}
          retry={{ onClick: () => void engine.refreshQueries() }}
          dataSet={{ testid: 'profile-load-error' }}
        />
      </Match>
    </Switch>
  );
}

export function ProfileScreen(props: ProfileScreenProps): JSX.Element {
  const { t } = useLingui();
  const router = useRouter();
  return (
    <ProfileScreenLayout
      screenId="profile"
      breadcrumbs={[{ name: <Trans>Profile</Trans> }]}
      identity={
        <>
          <ProfileAvatarFigure>
            <MyProfileAvatar size={96} />
          </ProfileAvatarFigure>
          <ProfileName />
          <StandInNotice />
          <AvatarRefusedChangeNotice />
          <UsernameChangeFeedback
            onChoose={() => router.push('/profile/handle')}
          />
        </>
      }
      identityActions={
        <Button
          title={t`Edit profile`}
          intent="neutral"
          variant="outline"
          fullWidth
          onClick={() => router.push('/profile/edit')}
          dataSet={{ testid: Handles.profileEdit }}
        />
      }
    >
      <StackVertical gap="md" self="stretch">
        <H2 size="subtitle">
          <Trans>Friends</Trans>
        </H2>
        {props.friendsStats}
        <StackHorizontal wrap gap="sm">
          {props.friendsActions}
        </StackHorizontal>
      </StackVertical>
    </ProfileScreenLayout>
  );
}
