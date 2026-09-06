/** @jsxImportSource solid-js */
/**
 * Wires preference + sampler + HUD overlay under the app shell. The sampler
 * defaults to the browser wall adapter on the injected timers; tests and
 * sims pass their own.
 */

import { useTimers } from '@pkgs/clock/solid';
import { type JSX, untrack } from 'solid-js';

import { PerfHudOverlay } from './perf-hud-overlay';
import {
  PerfHudPreferenceProvider,
  usePerfHudPreference,
} from './perf-hud-preference';
import { PerfSamplerProvider } from './perf-sampler-context';
import type { PerfSampler } from './types';
import { createWallPerfSampler } from './wall';

function PerfHudGate(props: {
  readonly sampler: PerfSampler;
  readonly children: JSX.Element;
}): JSX.Element {
  const { enabled } = usePerfHudPreference();
  return (
    <PerfSamplerProvider sampler={props.sampler} active={enabled}>
      {props.children}
      <PerfHudOverlay />
    </PerfSamplerProvider>
  );
}

export function PerfRoot(props: {
  readonly children: JSX.Element;
  /** Override for tests / sims; defaults to the wall sampler. */
  readonly sampler?: PerfSampler | undefined;
}): JSX.Element {
  const timers = useTimers();
  // Composition-root configuration: read once, not tracked.
  const sampler =
    untrack(() => props.sampler) ?? createWallPerfSampler({ timers });
  return (
    <PerfHudPreferenceProvider>
      <PerfHudGate sampler={sampler}>{props.children}</PerfHudGate>
    </PerfHudPreferenceProvider>
  );
}
