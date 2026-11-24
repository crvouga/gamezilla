import { spaceByLink } from '@libs/spaces-shared-ts/space-by-link-query';
import { useSyncEngineInstance } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type Accessor, createEffect, createSignal } from 'solid-js';

/**
 * While a space's screen is open, keep its row in sync — including for a
 * person who reached it by link and is in none of the space's parties yet.
 * Returns whether the server has answered for this link yet: until it has, a
 * missing row means "not here yet", not "does not exist".
 */
export function useSpaceByLink(spaceId: Accessor<string>): Accessor<boolean> {
  const sync = useSyncEngineInstance();
  // Another link starts unanswered.
  const [answered, setAnswered] = createSignal(() => {
    spaceId();
    return false;
  });
  createEffect(spaceId, (id) => {
    if (id.length === 0) return;
    const handle = sync.subscribeQueries([
      { name: spaceByLink.name, params: { spaceId: id } },
    ]);
    let live = true;
    void handle.ready.then((ready) => {
      if (live && ready) setAnswered(true);
    });
    return () => {
      live = false;
      handle.unsubscribe();
    };
  });
  return answered;
}
