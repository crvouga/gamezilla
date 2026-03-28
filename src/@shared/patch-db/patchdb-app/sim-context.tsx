import { createContext, useContext } from 'react';
import type { PlaygroundSim } from '../sim/playground-sim';
import type { TopoAnimHandle } from './playground-topology-graph';

export type SimContextValue = {
  sim: PlaygroundSim;
  topoRef: React.RefObject<TopoAnimHandle | null>;
  bumpGraph: () => void;
  bumpLink: () => void;
  addClient: () => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  reset: () => Promise<void>;
};

const SimContext = createContext<SimContextValue | null>(null);

export function useSimContext(): SimContextValue {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error('useSimContext: missing SimProvider');
  return ctx;
}

export const SimProvider = SimContext.Provider;
