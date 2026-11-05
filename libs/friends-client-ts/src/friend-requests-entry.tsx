import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { MenuList } from '@pkgs/ui-root-client-ts/menu-list';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { createSignal, For, type JSX, Show } from 'solid-js';
import {
  IncomingRequest,
  REQUESTS_SHOWN,
  useOpenRequester,
} from './friend-requests-aside';
import { useFriendRequests } from './use-friend-requests';

/**
 * Friend requests at the top of a phone's list of people (search, the
 * friends list), which has no column beside it, presentational: one
 * "Friend requests" row with how many are waiting, which opens to the same
 * requesters the desktop column lists (each opens their profile, where it
 * is answered). Nothing while nobody is waiting.
 */
export function FriendRequestsEntryView(props: {
  /** Who asked to be friends, by account id, newest first. */
  readonly incomingIds: readonly string[];
  /** One asker's row. */
  readonly request: (userId: string) => JSX.Element;
}): JSX.Element {
  const [expanded, setExpanded] = createSignal(false);
  const count = (): number => props.incomingIds.length;
  return (
    <Show when={count() > 0}>
      <MenuList>
        <MenuRow
          title={<Trans>Friend requests</Trans>}
          value={
            <Badge
              label={String(count())}
              intent="brand"
              tone="solid"
              size="sm"
            />
          }
          expanded={expanded()}
          onClick={() => setExpanded((now) => !now)}
        />
        <Show when={expanded()}>
          <For each={props.incomingIds.slice(0, REQUESTS_SHOWN)}>
            {(userId) => props.request(userId)}
          </For>
        </Show>
      </MenuList>
    </Show>
  );
}

/** {@link FriendRequestsEntryView} from synced requests. */
export function FriendRequestsEntry(): JSX.Element {
  const requests = useFriendRequests();
  const open = useOpenRequester();
  return (
    <FriendRequestsEntryView
      incomingIds={requests.incoming().map((request) => request.fromUserId)}
      request={(userId) => <IncomingRequest userId={userId} onOpen={open} />}
    />
  );
}
