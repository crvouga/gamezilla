import { Handles } from '@libs/test-ids-shared/handles';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { Pressable } from '@pkgs/ui-root-client/pressable';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { SpaceLiveBadge } from './space-live-badge';
import { openSpaceDetail } from './space-routes';
import { useFriendLiveSpaceId } from './use-friend-live-space-id';

export type FriendLiveSpaceBadgeProps = {
  readonly hostAccountId: string;
};

/** Shows a live badge when this friend hosts a discoverable live space. */
export function FriendLiveSpaceBadge(
  props: FriendLiveSpaceBadgeProps
): JSX.Element {
  const spaceId = useFriendLiveSpaceId(props.hostAccountId);
  const router = useRouter();
  return (
    <Show when={spaceId()} keyed>
      {(space) => (
        <Pressable
          testId={Handles.friendLiveSpace(props.hostAccountId)}
          onPress={() => openSpaceDetail(router, space)}
          paddingX="xs"
          radius="full"
        >
          <SpaceLiveBadge spaceId={space} />
        </Pressable>
      )}
    </Show>
  );
}
