import { useCurrentSpaceIds } from './use-current-space-ids';

/** Total spaces the current user is currently in (host or guest). */
export function useCurrentSpaceCount(): number {
  return useCurrentSpaceIds().entries.length;
}
