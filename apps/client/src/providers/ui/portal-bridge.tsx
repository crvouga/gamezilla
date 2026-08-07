import {
  SyncEngineProvider,
  useSyncEngine,
} from '@pkgs/sync-engine/client/sync-engine-context';
import { PortalContentBridgeProvider } from '@pkgs/ui';
import { type ReactNode, useCallback } from 'react';

/**
 * Re-supplies sync-engine context inside {@link ResponsiveSurface} portals
 * (`@gorhom/bottom-sheet` / `@gorhom/portal`).
 */
export function AppPortalContentBridge({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const engine = useSyncEngine();
  const wrap = useCallback(
    (content: ReactNode) => (
      <SyncEngineProvider value={engine}>{content}</SyncEngineProvider>
    ),
    [engine]
  );
  return (
    <PortalContentBridgeProvider wrap={wrap}>
      {children}
    </PortalContentBridgeProvider>
  );
}
