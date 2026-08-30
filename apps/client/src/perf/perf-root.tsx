/**
 * Wires preference + sampler + HUD overlay under the app shell.
 */

import { type ReactNode, useMemo } from 'react';

import { PerfHudOverlay } from './perf-hud-overlay';
import {
  PerfHudPreferenceProvider,
  usePerfHudPreference,
} from './perf-hud-preference';
import { PerfSamplerProvider } from './perf-sampler-context';
import { createWallPerfSampler } from './wall';

function PerfHudGate({ children }: { children: ReactNode }): ReactNode {
  const { enabled } = usePerfHudPreference();
  const sampler = useMemo(() => createWallPerfSampler(), []);
  return (
    <PerfSamplerProvider sampler={sampler} active={enabled}>
      {children}
      <PerfHudOverlay />
    </PerfSamplerProvider>
  );
}

export function PerfRoot({ children }: { children: ReactNode }): ReactNode {
  return (
    <PerfHudPreferenceProvider>
      <PerfHudGate>{children}</PerfHudGate>
    </PerfHudPreferenceProvider>
  );
}
