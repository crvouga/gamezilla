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

function RequestRow(props: {
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
    <RequestRow profile={profile()} onOpen={() => props.onOpen(profile())} />
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
 * Friend requests beside the search on a desktop, from synced requests: who
 * asked to be friends (each opens their profile, where it is answered, as
 * in the inbox), and how many the person sent are still waiting. Nothing
 * while there are none.
 */
export function SearchRequestsAside(): JSX.Element {
  const requests = useFriendRequests();
  const open = useOpenRequester();
  return (
    <Show
      when={requests.incoming().length > 0 || requests.outgoing().length > 0}
    >
      <MenuSection
        title={<Trans>Friend requests</Trans>}
        footer={
          <Show when={requests.outgoing().length > 0}>
            <Plural
              value={requests.outgoing().length}
              one="You sent # request that is still waiting."
              other="You sent # requests that are still waiting."
            />
          </Show>
        }
      >
        <Show
          when={requests.incoming().length > 0}
          fallback={
            <MenuRow
              title={<Trans>Nobody is waiting on you</Trans>}
              hideChevron
            />
          }
        >
          <For each={requests.incoming().slice(0, REQUESTS_SHOWN)}>
            {(request) => (
              <IncomingRequest userId={request.fromUserId} onOpen={open} />
            )}
          </For>
        </Show>
      </MenuSection>
    </Show>
  );
}
