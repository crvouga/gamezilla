import { OpenSpaceIdsProvider } from '@libs/spaces/client/open-space/use-open-space-ids';
import type { ReactNode } from 'react';

/**
 * Shared open-space Kv state for miniplayer / presence.
 * Must sit under auth (account id) and KvProvider.
 */
export function AppOpenSpacesProvider({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  return <OpenSpaceIdsProvider>{children}</OpenSpaceIdsProvider>;
}
