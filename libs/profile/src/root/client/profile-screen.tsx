import { Handles } from '@libs/test-ids';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button, ScreenBase, useRouter } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { MyProfileAvatar } from './my-profile-avatar';
import { MyUsername } from './my-username';

export type ProfileScreenProps = {
  /** Centered friends stats row (signed-in counts; guests open sign-in on tap). */
  readonly friendsStats?: JSX.Element | undefined;
  /** Second action pill beside Edit profile (e.g. Find friends). */
  readonly friendsActions?: JSX.Element | undefined;
};

export function ProfileScreen(props: ProfileScreenProps): JSX.Element {
  return (
    <ScreenBase
      screenId="profile"
      surface="canvas"
      scroll
      breadcrumbs={[{ name: <Trans>Profile</Trans> }]}
      content={() => (
        <ProfileScreenContent
          friendsStats={props.friendsStats}
          friendsActions={props.friendsActions}
        />
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
    <div class="box gap-6 pt-2">
      <div class="box items-center gap-3">
        <MyProfileAvatar size={96} />
        <div class="box items-center gap-1 self-stretch min-w-0">
          <MyUsername variant="heading" numberOfLines={1} class="text-center" />
        </div>
        <div class="box flex-row gap-2 self-stretch mt-2">
          <Button
            title={t`Edit profile`}
            intent="neutral"
            variant="outline"
            flex={1}
            onClick={() => router.push('/profile/edit')}
            dataSet={{ testid: Handles.profileEdit }}
          />
        </div>
      </div>
      <div class="box gap-3 self-stretch">
        <h2 class="text textSubtitle">
          <Trans>Friends</Trans>
        </h2>
        {props.friendsStats !== undefined && props.friendsStats !== null
          ? props.friendsStats
          : null}
        {props.friendsActions !== undefined && props.friendsActions !== null ? (
          <div class="box flex-row flex-wrap gap-2 min-w-0">
            {props.friendsActions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
