import type { FriendProfile } from '@libs/friends-shared-ts/friends-types';
import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import { usernameLabel } from '@libs/moderation-shared-ts/display';
import { useProfileRow } from '@libs/profile-client-ts/public-use-profile-row';
import { Plural, Trans, useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { createMemo, For, type JSX, Show } from 'solid-js';
import { FriendProfileAvatar } from './friend-profile-avatar';
import { useFriendRequests } from './use-friend-requests';

const FACE_SIZE = 32;
/** The column lists a few; the inbox has every request. */
export const REQUESTS_SHOWN = 4;

/** One person who asked to be friends; the row opens their profile. */
export function FriendRequestRow(props: {
  readonly profile: FriendProfile;
  readonly onOpen: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const moderation = useModeration();
  const name = createMemo(() =>
    usernameLabel(moderation(), props.profile.username, props.profile.userId)
  );
  return (
    <MenuRow
      leading={
        <FriendProfileAvatar
          profile={props.profile}
          name={name()}
          size={FACE_SIZE}
        />
      }
      title={name()}
      caption={t`Wants to be friends`}
      onClick={() => props.onOpen()}
    />
  );
}

/**
 * Friend requests in a desktop column, presentational: who asked to be
 * friends (each row opens their profile, where it is answered, as in the
 * inbox), and how many the person sent are still waiting. Nothing while
 * there are none.
 */
export function FriendRequestsAsideView(props: {
  /** Who asked to be friends, by account id, newest first. */
  readonly incomingIds: readonly string[];
  /** How many requests the person sent are still waiting. */
  readonly outgoingCount: number;
  /** One asker's row ({@link FriendRequestRow}). */
  readonly request: (userId: string) => JSX.Element;
}): JSX.Element {
  return (
    <Show when={props.incomingIds.length > 0 || props.outgoingCount > 0}>
      <MenuSection
        title={<Trans>Friend requests</Trans>}
        footer={
          <Show when={props.outgoingCount > 0}>
            <Plural
              value={props.outgoingCount}
              one="You sent # request that is still waiting."
              other="You sent # requests that are still waiting."
            />
          </Show>
        }
      >
        <Show
          when={props.incomingIds.length > 0}
          fallback={
            <MenuRow
              title={<Trans>Nobody is waiting on you</Trans>}
              hideChevron
            />
          }
        >
          <For each={props.incomingIds.slice(0, REQUESTS_SHOWN)}>
            {(userId) => props.request(userId)}
          </For>
        </Show>
      </MenuSection>
    </Show>
  );
}

/** One requester as this device knows them (username empty until synced). */
function useRequester(userId: () => string): () => FriendProfile {
  const row = useProfileRow(userId);
  return () => ({
    userId: userId(),
    username: row.row()?.username ?? '',
    avatarConfig: row.row()?.avatar_config ?? null,
  });
}

/** One person who asked to be friends, as a row that opens them. */
export function IncomingRequest(props: {
  readonly userId: string;
  readonly onOpen: (profile: FriendProfile) => void;
}): JSX.Element {
  const profile = useRequester(() => props.userId);
  return (
    <FriendRequestRow
      profile={profile()}
      onOpen={() => props.onOpen(profile())}
    />
  );
}

/** Opens a requester's profile, where their request is answered. */
export function useOpenRequester(): (profile: FriendProfile) => void {
  const router = useRouter();
  return (profile) =>
    router.push({
      pathname: '/profile/user/[userId]',
      params: {
        userId: profile.userId,
        username: profile.username,
        avatarConfig: profile.avatarConfig ?? '',
      },
    });
}

/**
 * Friend requests beside a list of people on a desktop (search, the
 * friends list), from synced requests. Nothing while there are none.
 */
export function FriendRequestsAside(): JSX.Element {
  const requests = useFriendRequests();
  const open = useOpenRequester();
  return (
    <FriendRequestsAsideView
      incomingIds={requests.incoming().map((request) => request.fromUserId)}
      outgoingCount={requests.outgoing().length}
      request={(userId) => <IncomingRequest userId={userId} onOpen={open} />}
    />
  );
}
