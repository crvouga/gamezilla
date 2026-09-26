import { useSyncEngineInstance } from '@pkgs/sync-engine/solid';
import { type Accessor, createEffect, onCleanup } from 'solid-js';

import { spaceByLink } from '../shared/space-by-link-query';

/**
 * While a space's screen is open, keep its row in sync — including for a
 * person who reached it by link and is in none of the space's parties yet.
 */
export function useSpaceByLink(spaceId: Accessor<string>): void {
  const sync = useSyncEngineInstance();
  createEffect(() => {
    const id = spaceId();
    if (id.length === 0) return;
    const handle = sync.subscribeQueries([
      { name: spaceByLink.name, params: { spaceId: id } },
    ]);
    onCleanup(() => handle.unsubscribe());
  });
}
