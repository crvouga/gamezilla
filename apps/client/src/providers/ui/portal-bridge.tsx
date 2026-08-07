import {
  SyncEngineProvider,
  useSyncEngineInstance,
} from '@pkgs/sync-engine/client';
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
  const engine = useSyncEngineInstance();
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
