import { createContext, useContext } from 'react';
import type { PlaygroundSim } from '@gamezilla/patch-db/sim/playground-sim';

export type SimContextValue = {
  sim: PlaygroundSim;
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
