import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { MenuList } from '@pkgs/ui-root-client-ts/menu-list';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { createSignal, For, type JSX, Show } from 'solid-js';
import {
  IncomingRequest,
  REQUESTS_SHOWN,
  useOpenRequester,
} from './search-requests-aside';
import { useFriendRequests } from './use-friend-requests';

/**
 * Friend requests under the search field on a phone, which has no column
 * beside the search: one "Friend requests" row with how many are waiting,
 * which opens to the same requesters the desktop column lists (each opens
 * their profile, where it is answered). Nothing while nobody is waiting.
 */
export function SearchRequestsEntry(): JSX.Element {
  const requests = useFriendRequests();
  const open = useOpenRequester();
  const [expanded, setExpanded] = createSignal(false);
  const count = (): number => requests.incoming().length;
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
          <For each={requests.incoming().slice(0, REQUESTS_SHOWN)}>
            {(request) => (
              <IncomingRequest userId={request.fromUserId} onOpen={open} />
            )}
          </For>
        </Show>
      </MenuList>
    </Show>
  );
}
