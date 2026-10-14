import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { Button } from '@pkgs/ui-root-client/button';
import { ProfileScreenLayout } from '@pkgs/ui-root-client/profile-screen-layout';
import type { JSX } from 'solid-js';
import { MyProfileAvatar } from './my-profile-avatar';
import { MyUsername } from './my-username';
import { ProfileAvatarFigure } from './profile-avatar-figure';
import { StandInNotice } from './stand-in-notice';
import { UsernameChangeFeedback } from './username-change-feedback';

export type ProfileScreenProps = {
  /** Centered friends stats row (signed-in counts; guests open sign-in on tap). */
  readonly friendsStats?: JSX.Element | undefined;
  /** Second action pill beside Edit profile (e.g. Find friends). */
  readonly friendsActions?: JSX.Element | undefined;
};

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
          <MyUsername variant="heading" numberOfLines={1} class="text-center" />
          <StandInNotice />
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
      <div class="box gap-3 self-stretch">
        <h2 class="text textSubtitle">
          <Trans>Friends</Trans>
        </h2>
        {props.friendsStats}
        <div class="box flex-row flex-wrap gap-2 min-w-0">
          {props.friendsActions}
        </div>
      </div>
    </ProfileScreenLayout>
  );
}
