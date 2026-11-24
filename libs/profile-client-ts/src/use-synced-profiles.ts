import { profilesByIds } from '@libs/profile-shared-ts/profiles-by-ids-query';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type Accessor, createEffect, createMemo } from 'solid-js';

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
    () => [...new Set(ids().filter((id) => id.length > 0))].sort(),
    { equals: (a, b) => a.join('\n') === b.join('\n') }
  );
  createEffect(
    () => wanted(),
    (list) => {
      const subscriptions: { unsubscribe: () => void }[] = [];
      for (
        let offset = 0;
        offset < list.length;
        offset += MAX_SYNCED_PROFILES
      ) {
        subscriptions.push(
          engine.subscribeQuery(profilesByIds.name, {
            ids: list.slice(offset, offset + MAX_SYNCED_PROFILES),
          })
        );
      }
      return () => {
        for (const subscription of subscriptions) subscription.unsubscribe();
      };
    }
  );
}
