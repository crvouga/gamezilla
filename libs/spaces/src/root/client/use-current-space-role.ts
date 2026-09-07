import { type Accessor, createMemo } from 'solid-js';
import { useSpacePresence } from '../../public/use-space-presence';

/**
 * Returns the current user's role on `spaceId` — `'host'`, `'guest'`, or
 * `null` when they aren't in the space (or presence is still loading).
 */
export function useCurrentSpaceRole(
  spaceId: string | Accessor<string>
): Accessor<'host' | 'guest' | null> {
  const presence = useSpacePresence(spaceId);
  return createMemo(() => {
    const current = presence();
    return current.status === 'active' ? current.role : null;
  });
}
