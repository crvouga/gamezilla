import { useSyncEngineSubscriptions } from '@pkgs/sync-engine/client/use-sync-engine-subscriptions';
import { useMemo, type ReactNode } from 'react';

const SHELL_QUERY_NAMES = [
  'mySpaces',
  'mySpaceUsers',
  'friendships',
  'friendRequests',
  'userBlocks',
  'inboxActive',
  'entityStoreCatalog',
  'entityStoreOwned',
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
  const specs = useMemo(
    () =>
      SHELL_QUERY_NAMES.map((name) => ({
        name,
        params: {},
      })),
    []
  );
  useSyncEngineSubscriptions(specs);
  return children;
}
