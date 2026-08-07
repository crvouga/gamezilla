import { useSyncEngineInstance } from '@pkgs/sync-engine/client/sync-engine-context';
import { type ReactNode, useEffect, useMemo } from 'react';

const SHELL_QUERY_NAMES = [
  'mySpaces',
  'mySpaceUsers',
  'friendships',
  'friendRequests',
  'userBlocks',
  'inboxActive',
  'chessPuzzleProfile',
  'chessPuzzleInteractions',
] as const;

/**
 * After boot paint, keep shell-scoped API queries polled for the session.
 */
export function ShellQuerySubscriptions({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  // Stable engine — reactive useSyncEngine() would resubscribe on every status patch.
  const sync = useSyncEngineInstance();
  const specs = useMemo(
    () =>
      SHELL_QUERY_NAMES.map((name) => ({
        name,
        params: {},
      })),
    []
  );
  useEffect(() => {
    const handle = sync.subscribeQueries(specs);
    return () => handle.unsubscribe();
  }, [sync, specs]);
  return children;
}
