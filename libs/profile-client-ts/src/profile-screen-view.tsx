import type { AvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { SettingsIcon, SquarePenIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuList } from '@pkgs/ui-root-client-ts/menu-list';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { ProfileScreenLayout } from '@pkgs/ui-root-client-ts/profile-screen-layout';
import { Skeleton } from '@pkgs/ui-root-client-ts/skeleton';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { Match, Show, Switch } from 'solid-js';
import { DeviceAvatar } from './device-avatar';
import { ProfileAvatarFigure } from './profile-avatar-figure';
import { UserUsernameView } from './user-username-view';
import {
  type UsernameChange,
  UsernameChangeFeedbackView,
} from './username-change-feedback-view';

/** Whether the person's own profile row is still reading, could not load, or is known. */
export type ProfileScreenStatus = 'loading' | 'failed' | 'ready';

/** The person's own identity as this device knows it. */
export type ProfileIdentity = {
  readonly profileId: string;
  /** The stored username, or null while the row has not synced. */
  readonly username: string | null;
  readonly avatarConfig: AvatarConfig | null;
  readonly isBot: boolean;
};

export type ProfileScreenViewProps = {
  readonly status: ProfileScreenStatus;
  /** Null until the session has an id; the avatar then shows a silhouette. */
  readonly identity: ProfileIdentity | null;
  /** The alias others see while the username is no longer allowed. */
  readonly standInName: string | null;
  /** The last username change, while it is shared or after it was refused. */
  readonly usernameChange: UsernameChange | null;
  /** Inline notice for a refused avatar change, under the identity. */
  readonly notice?: JSX.Element;
  /** Centered friends stats row (signed-in counts; guests open sign-in on tap). */
  readonly friendsStats?: JSX.Element | undefined;
  /** The friends section's call to action, under the count (Find friends). */
  readonly friendsActions?: JSX.Element | undefined;
  readonly onEditProfile: () => void;
  /** Opens Settings (appearance, sound, account and the rest). */
  readonly onOpenSettings: () => void;
  readonly onChooseUsername: () => void;
  readonly onRetry: () => void;
};

/** The name under the avatar: a placeholder while loading, an explanation when it cannot arrive. */
function ProfileName(
  props: Pick<ProfileScreenViewProps, 'status' | 'identity' | 'onRetry'>
): JSX.Element {
  return (
    <Switch
      fallback={
        <Show when={props.identity}>
          {(identity) => (
            <UserUsernameView
              profileId={identity().profileId}
              username={identity().username}
              isBot={identity().isBot}
              variant="heading"
              numberOfLines={1}
              align="center"
              dataSet={{ testid: Handles.profileDisplayUsername }}
            />
          )}
        </Show>
      }
    >
      <Match when={props.status === 'loading'}>
        <Skeleton width="40%" height={28} />
      </Match>
      <Match when={props.status === 'failed'}>
        <ErrorState
          variant="compact"
          title={<Trans>Your profile could not be loaded</Trans>}
          body={<Trans>Check your connection and try again.</Trans>}
          retry={{ onClick: () => props.onRetry() }}
          dataSet={{ testid: 'profile-load-error' }}
        />
      </Match>
    </Switch>
  );
}

function StandInNoticeView(props: { readonly alias: string }): JSX.Element {
  const { t } = useLingui();
  const notice = (alias: string) =>
    t`Other people see you as ${alias} until you choose a new username`;
  return (
    <P variant="caption" align="center" testId={Handles.profileStandInNotice}>
      {notice(props.alias)}
    </P>
  );
}

/** The way from a profile to Settings: one row, under the friends section. */
function ProfileSettingsEntry(props: {
  readonly onOpen: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <MenuList>
      <MenuRow
        title={t`Settings`}
        caption={t`Account, appearance, sound and more`}
        leading={<SettingsIcon size={20} color="icon" />}
        onClick={() => props.onOpen()}
      />
    </MenuList>
  );
}

/**
 * `/profile`, presentational: the person's own avatar, name, username and
 * avatar notices, Edit profile, the friends slots and the way to Settings.
 * On a wide screen the identity sits in its own column beside the sections.
 * Data arrives as props; `ProfileScreen` wires them to the sync engine.
 */
export function ProfileScreenView(props: ProfileScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <ProfileScreenLayout
      screenId="profile"
      breadcrumbs={[{ name: <Trans>Profile</Trans> }]}
      identity={
        <>
          <ProfileAvatarFigure>
            <DeviceAvatar
              avatarConfig={props.identity?.avatarConfig ?? null}
              seedFallback={props.identity?.profileId ?? 'pending'}
              size={96}
              vividBackdrop={false}
            />
          </ProfileAvatarFigure>
          <ProfileName
            status={props.status}
            identity={props.identity}
            onRetry={props.onRetry}
          />
          <Show when={props.standInName}>
            {(alias) => <StandInNoticeView alias={alias()} />}
          </Show>
          {props.notice}
          <UsernameChangeFeedbackView
            change={props.usernameChange}
            onChoose={() => props.onChooseUsername()}
          />
        </>
      }
      identityActions={
        // A compact pill under the name: editing is part of who you are,
        // not the page's main call to action.
        <Button
          title={t`Edit profile`}
          intent="neutral"
          variant="outline"
          size="sm"
          icon={SquarePenIcon}
          onClick={() => props.onEditProfile()}
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
      <ProfileSettingsEntry onOpen={() => props.onOpenSettings()} />
    </ProfileScreenLayout>
  );
}
