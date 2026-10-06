import { profilesByIds } from '@libs/profile-shared/profiles-by-ids-query';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, onCleanup } from 'solid-js';

/** The most profiles one subscription asks for (the query's own bound). */
const MAX_SYNCED_PROFILES = 200;

/**
 * Keep the profiles of `ids` synced to this device while the caller is
 * mounted, so `UserUsername` and friends can name people the device has no
 * other reason to know (the other people in a space).
 */
export function useSyncedProfiles(ids: Accessor<readonly string[]>): void {
  const engine = useSyncEngine();
  const wanted = createMemo(
    () =>
      [...new Set(ids().filter((id) => id.length > 0))]
        .sort()
        .slice(0, MAX_SYNCED_PROFILES),
    [],
    { equals: (a, b) => a.join('\n') === b.join('\n') }
  );
  createEffect(() => {
    const list = wanted();
    if (list.length === 0) return;
    const subscription = engine.subscribeQuery(profilesByIds.name, {
      ids: list,
    });
    onCleanup(() => subscription.unsubscribe());
  });
}
