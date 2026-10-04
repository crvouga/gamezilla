import { useMyId } from '@libs/auth-client/use-current-user';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';

/**
 * Profile entity id for the current session: account id when signed in,
 * else install device id; `null` when neither is available yet.
 *
 * Atoms that take an optional `profileId` accept this `null` directly and
 * render an empty / fallback state.
 */
export function useMyProfileId(): Accessor<string | null> {
  const id = useMyId();
  return createMemo(() => {
    const value = id();
    return value.length > 0 ? value : null;
  });
}
