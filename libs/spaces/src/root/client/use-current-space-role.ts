import { useSpacePresence } from '../../public/use-space-presence';

/**
 * Returns the current user's role on `spaceId` — `'host'`, `'guest'`, or
 * `null` when they aren't in the space (or presence is still loading).
 */
export function useCurrentSpaceRole(spaceId: string): 'host' | 'guest' | null {
  const presence = useSpacePresence(spaceId);
  if (presence.status === 'active') {
    return presence.role;
  }
  return null;
}
