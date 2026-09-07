import { useCurrentSpaceIds } from './use-current-space-ids';

/** Total spaces the current user is currently in (host or guest). */
export function useCurrentSpaceCount(): {
  readonly count: number;
  readonly isLoading: boolean;
} {
  const current = useCurrentSpaceIds();
  return {
    get count() {
      return current.entries.length;
    },
    get isLoading() {
      return current.isLoading;
    },
  };
}
