import type { HostNavPatch, HostNavState } from '@apps/client/host/host-nav';
import { createContext, useContext } from 'react';

export type HostChromeContextValue = {
  readonly state: HostNavState;
  readonly patch: (partial: HostNavPatch, mode?: 'push' | 'replace') => void;
};

const HostChromeContext = createContext<HostChromeContextValue | null>(null);

export const HostChromeProvider = HostChromeContext.Provider;

export function useHostChrome(): HostChromeContextValue {
  const value = useContext(HostChromeContext);
  if (value === null) {
    throw new Error('useHostChrome requires HostChromeProvider');
  }
  return value;
}
