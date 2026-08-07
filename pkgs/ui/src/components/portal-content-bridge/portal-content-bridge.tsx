/**
 * Re-wrap portaled overlay content (e.g. `@gorhom/bottom-sheet` via
 * `@gorhom/portal`) so app contexts survive outside the main tree.
 *
 * Apps register a `wrap` callback on {@link PortalContentBridgeProvider};
 * {@link ResponsiveSurface} applies it to `children` before they enter a portal.
 */

import { createContext, type ReactNode, useContext } from 'react';

export type PortalContentWrap = (content: ReactNode) => ReactNode;

const identityWrap: PortalContentWrap = (content) => content;

const PortalContentBridgeContext =
  createContext<PortalContentWrap>(identityWrap);

export type PortalContentBridgeProviderProps = {
  wrap: PortalContentWrap;
  children: ReactNode;
};

export function PortalContentBridgeProvider({
  wrap,
  children,
}: PortalContentBridgeProviderProps): ReactNode {
  return (
    <PortalContentBridgeContext.Provider value={wrap}>
      {children}
    </PortalContentBridgeContext.Provider>
  );
}

/** Wrap overlay body content before it is portaled. Defaults to identity. */
export function usePortalContentWrap(): PortalContentWrap {
  return useContext(PortalContentBridgeContext);
}
