import type { AvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { SettingsIcon, SquarePenIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuList } from '@pkgs/ui-root-client-ts/menu-list';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import {
  MetricStrip,
  type SummaryMetric,
} from '@pkgs/ui-root-client-ts/metric-strip';
import { ProfileScreenLayout } from '@pkgs/ui-root-client-ts/profile-screen-layout';
import { Skeleton } from '@pkgs/ui-root-client-ts/skeleton';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import {
  createMemo,
  Match,
  children as resolveChildren,
  Show,
  Switch,
} from 'solid-js';
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
  /** When the profile was made (ISO), or null until its row has synced. */
  readonly joinedAt: string | null;
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
  /** The friends panel's row to the friends list (signed-in; guests open sign-in on tap). */
  readonly friendsStats?: JSX.Element | undefined;
  /** How many friends, as the number the identity's Friends fact shows. */
  readonly friendsCount?: JSX.Element | undefined;
  /** The friends panel's action rows, under the count (Find friends). */
  readonly friendsActions?: JSX.Element | undefined;
  /**
   * The rooms friends are in right now, each with Join: the page's main
   * section, drawn by the friends sub (nothing while nobody is playing).
   */
  readonly friendsPlaying?: JSX.Element | undefined;
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
              align="start"
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
 * The friends slots as one titled panel: the count row, then the way to
 * find more. Nothing at all when no friends sub fills the slots.
 */
function ProfileFriendsSection(props: {
  readonly stats: JSX.Element | undefined;
  readonly actions: JSX.Element | undefined;
}): JSX.Element {
  const rows = resolveChildren(() => [props.stats, props.actions]);
  const present = createMemo(() =>
    rows
      .toArray()
      .some((node) => node !== null && node !== undefined && node !== false)
  );
  return (
    <Show when={present()}>
      <MenuSection title={<Trans>Friends</Trans>}>{rows()}</MenuSection>
    </Show>
  );
}

/**
 * The face in the profile's own identity, beside the name on every size:
 * never a hero-sized echo of the header's own avatar.
 */
const AVATAR_SIZE = 64;

/** "November 2023": the month a profile was made, in the reader's locale. */
function useJoinedLabel(joinedAt: () => string | null): () => string | null {
  const { i18n } = useLingui();
  return () => {
    const at = joinedAt();
    if (at === null) return null;
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(i18n().locale, {
      month: 'long',
      year: 'numeric',
    }).format(date);
  };
}

/**
 * Facts about the person beside their name, only those this device knows:
 * how many friends (when a friends sub is composed) as the one stat, and
 * when they joined as a quiet caption under it, so the date never outweighs
 * the name. Nothing while neither is known.
 */
function ProfileFacts(props: {
  readonly friendsCount: JSX.Element | undefined;
  readonly joinedAt: string | null;
}): JSX.Element {
  const { t } = useLingui();
  const joined = useJoinedLabel(() => props.joinedAt);
  const metrics = createMemo((): readonly SummaryMetric[] =>
    props.friendsCount === undefined
      ? []
      : [{ label: <Trans>Friends</Trans>, value: props.friendsCount }]
  );
  return (
    <Show when={metrics().length > 0 || joined() !== null}>
      <StackVertical gap="xs" testId={Handles.profileFacts}>
        <Show when={metrics().length > 0}>
          <MetricStrip aria-label={t`About you`} metrics={metrics()} />
        </Show>
        <Show when={joined()}>
          {(month) => (
            <P variant="caption" tone="secondary">
              <Trans>Joined {month()}</Trans>
            </P>
          )}
        </Show>
      </StackVertical>
    </Show>
  );
}

/**
 * `/profile`, presentational: the person's own avatar, name and the facts
 * this device knows (friends, when they joined), username and avatar
 * notices, Edit profile, the rooms friends are playing in now (each with
 * Join), the friends panel (their faces, then Find friends) and the way to
 * Settings. On a phone the identity is a compact panel read from the start
 * edge, the picture beside the name, with the rest stacked under it; on a
 * desktop it is the page's own header, and under it the rooms take the
 * main column with Friends and Settings beside them, tops level.
 * Data arrives as props; `ProfileScreen` wires them to the sync engine.
 */
export function ProfileScreenView(props: ProfileScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <ProfileScreenLayout
      screenId="profile"
      breadcrumbs={[{ name: <Trans>Profile</Trans> }]}
      avatar={
        <ProfileAvatarFigure>
          <DeviceAvatar
            avatarConfig={props.identity?.avatarConfig ?? null}
            seedFallback={props.identity?.profileId ?? 'pending'}
            size={AVATAR_SIZE}
            vividBackdrop={false}
          />
        </ProfileAvatarFigure>
      }
      identity={
        <>
          <ProfileName
            status={props.status}
            identity={props.identity}
            onRetry={props.onRetry}
          />
          <Show when={props.status !== 'loading'}>
            <ProfileFacts
              friendsCount={props.friendsCount}
              joinedAt={props.identity?.joinedAt ?? null}
            />
          </Show>
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
        // A compact pill (under the name on a phone, right after the words
        // in a desktop's header): editing is part of who you are, not the
        // page's main call to action.
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
      rail={
        <>
          <ProfileFriendsSection
            stats={props.friendsStats}
            actions={props.friendsActions}
          />
          <ProfileSettingsEntry onOpen={() => props.onOpenSettings()} />
        </>
      }
    >
      {props.friendsPlaying}
    </ProfileScreenLayout>
  );
}
