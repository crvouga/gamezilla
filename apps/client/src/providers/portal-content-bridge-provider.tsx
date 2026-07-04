import {
  PatchDbContextProvider,
  usePatchDbValue,
} from '@pkgs/patch-db/react';
import { PortalContentBridgeProvider } from '@pkgs/ui';
import { useCallback, type ReactNode } from 'react';

/**
 * Re-supplies patch-db context inside {@link ResponsiveSurface} portals
 * (`@gorhom/bottom-sheet` / `@gorhom/portal`), where the host subtree does
 * not inherit {@link PatchDbContextProvider}.
 */
export function AppPortalContentBridgeProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const patchDb = usePatchDbValue();
  const wrap = useCallback(
    (content: ReactNode) => (
      <PatchDbContextProvider value={patchDb}>{content}</PatchDbContextProvider>
    ),
    [patchDb]
  );
  return (
    <PortalContentBridgeProvider wrap={wrap}>{children}</PortalContentBridgeProvider>
  );
}
