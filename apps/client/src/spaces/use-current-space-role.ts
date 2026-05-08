import { useCurrentSpaceIds } from '@gamezilla/client/spaces/use-current-space-ids';

/**
 * Returns the current user's role on `spaceId` — `'host'`, `'guest'`, or
 * `null` when they aren't in the space.
 */
export function useCurrentSpaceRole(spaceId: string): 'host' | 'guest' | null {
  const { entries } = useCurrentSpaceIds();
  const entry = entries.find((e) => e.spaceId === spaceId);
  return entry?.role ?? null;
}
