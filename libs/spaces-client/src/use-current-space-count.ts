import { type Accessor, createMemo } from 'solid-js';
import { useCurrentSpaceIds } from './use-current-space-ids';

/** Total spaces the current user is currently in (host or guest). */
export function useCurrentSpaceCount(): {
  readonly count: Accessor<number>;
  readonly isLoading: Accessor<boolean>;
} {
  const current = useCurrentSpaceIds();
  return {
    count: createMemo(() => current.entries().length),
    isLoading: current.isLoading,
  };
}
