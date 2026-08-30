/**
 * React context for the injected {@link PerfSampler}.
 */

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from 'react';

import { createNoopPerfSampler, type PerfSampler } from './types';

const PerfSamplerContext = createContext<PerfSampler | null>(null);

export type PerfSamplerProviderProps = {
  readonly children: ReactNode;
  readonly sampler: PerfSampler;
  /** When true, starts sampling on mount (HUD visible). */
  readonly active?: boolean;
};

export function PerfSamplerProvider({
  children,
  sampler,
  active = false,
}: PerfSamplerProviderProps): ReactNode {
  useEffect(() => {
    if (!active) {
      sampler.stop();
      return undefined;
    }
    sampler.start();
    return () => {
      sampler.stop();
    };
  }, [active, sampler]);

  const value = useMemo(() => sampler, [sampler]);
  return (
    <PerfSamplerContext.Provider value={value}>
      {children}
    </PerfSamplerContext.Provider>
  );
}

export function usePerfSampler(): PerfSampler {
  const ctx = useContext(PerfSamplerContext);
  return ctx ?? createNoopPerfSampler();
}
