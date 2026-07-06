import { PatchDbContextProvider, usePatchDbValue } from '@pkgs/patch-db/react';
import { PortalContentBridgeProvider } from '@pkgs/ui';
import { useCallback, type ReactNode } from 'react';

/**
 * Re-supplies patch-db context inside {@link ResponsiveSurface} portals
 * (`@gorhom/bottom-sheet` / `@gorhom/portal`).
 */
export function AppPortalContentBridge({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  // #region agent log
  fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': 'b580fa',
    },
    body: JSON.stringify({
      sessionId: 'b580fa',
      location: 'portal-bridge.tsx:render',
      message: 'AppPortalContentBridge render',
      hypothesisId: 'H10',
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  const patchDb = usePatchDbValue();
  const wrap = useCallback(
    (content: ReactNode) => (
      <PatchDbContextProvider value={patchDb}>{content}</PatchDbContextProvider>
    ),
    [patchDb]
  );
  return (
    <PortalContentBridgeProvider wrap={wrap}>
      {children}
    </PortalContentBridgeProvider>
  );
}
