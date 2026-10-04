import { useSyncEngineInstance } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';

import { spaceByLink } from '@libs/spaces-shared/space-by-link-query';

/**
 * While a space's screen is open, keep its row in sync — including for a
 * person who reached it by link and is in none of the space's parties yet.
 * Returns whether the server has answered for this link yet: until it has, a
 * missing row means "not here yet", not "does not exist".
 */
export function useSpaceByLink(spaceId: Accessor<string>): Accessor<boolean> {
  const sync = useSyncEngineInstance();
  const [answered, setAnswered] = createSignal(false);
  createEffect(() => {
    const id = spaceId();
    setAnswered(false);
    if (id.length === 0) return;
    const handle = sync.subscribeQueries([
      { name: spaceByLink.name, params: { spaceId: id } },
    ]);
    let live = true;
    void handle.ready.then((ready) => {
      if (live && ready) setAnswered(true);
    });
    onCleanup(() => {
      live = false;
      handle.unsubscribe();
    });
  });
  return answered;
}
