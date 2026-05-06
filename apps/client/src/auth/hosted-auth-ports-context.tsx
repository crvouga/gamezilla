import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import type { HostedAuthPorts } from './ports';

const HostedAuthPortsContext = createContext<HostedAuthPorts | null>(null);

export function HostedAuthPortsProvider({
  value,
  children,
}: {
  value: HostedAuthPorts;
  children: ReactNode;
}) {
  return (
    <HostedAuthPortsContext.Provider value={value}>
      {children}
    </HostedAuthPortsContext.Provider>
  );
}

export function useHostedAuthPorts(): HostedAuthPorts {
  const v = useContext(HostedAuthPortsContext);
  if (v === null) {
    throw new Error('useHostedAuthPorts requires HostedAuthPortsProvider');
  }
  return v;
}
