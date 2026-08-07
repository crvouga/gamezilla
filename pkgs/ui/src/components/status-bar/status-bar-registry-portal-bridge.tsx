import { type ReactNode, useCallback } from 'react';

import {
  PortalContentBridgeProvider,
  usePortalContentWrap,
} from '../portal-content-bridge';
import {
  StatusBarRegistryContext,
  useStatusBarRegistry,
} from './status-bar-registry-context';

export type StatusBarRegistryPortalBridgeProps = {
  children: ReactNode;
};

/**
 * Re-provides {@link StatusBarRegistryProvider} inside ResponsiveSurface /
 * bottom-sheet portals (same pattern as the sync-engine portal bridge).
 * Mount under {@link StatusBarRegistryProvider}.
 */
export function StatusBarRegistryPortalBridge({
  children,
}: StatusBarRegistryPortalBridgeProps): ReactNode {
  const registry = useStatusBarRegistry();
  const outerWrap = usePortalContentWrap();
  const wrap = useCallback(
    (content: ReactNode) =>
      outerWrap(
        <StatusBarRegistryContext.Provider value={registry}>
          {content}
        </StatusBarRegistryContext.Provider>
      ),
    [outerWrap, registry]
  );
  return (
    <PortalContentBridgeProvider wrap={wrap}>
      {children}
    </PortalContentBridgeProvider>
  );
}
