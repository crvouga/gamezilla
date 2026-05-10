import { useCurrentSpaceIds } from '@gamezilla/client/spaces/use-current-space-ids';

/** Total spaces the current user is currently in (host or guest). */
export function useCurrentSpaceCount(): number {
  return useCurrentSpaceIds().entries.length;
}
