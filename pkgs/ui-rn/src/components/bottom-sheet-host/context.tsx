import { createContext, type ReactNode, useContext } from 'react';

import type { BottomSheetHost } from './types';

const BottomSheetHostContext = createContext<BottomSheetHost | null>(null);

export function BottomSheetHostProvider({
  host,
  children,
}: {
  host: BottomSheetHost;
  children: ReactNode;
}): ReactNode {
  return (
    <BottomSheetHostContext.Provider value={host}>
      {children}
    </BottomSheetHostContext.Provider>
  );
}

export function useBottomSheetHost(): BottomSheetHost {
  const host = useContext(BottomSheetHostContext);
  if (host === null) {
    throw new Error(
      'useBottomSheetHost: BottomSheetHostProvider missing — wrap with AppUiPortals / createClient'
    );
  }
  return host;
}
