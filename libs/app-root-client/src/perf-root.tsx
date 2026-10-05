import { createWallPerfSampler } from './wall';
/** @jsxImportSource solid-js */
/**
 * Wires preference + sampler under the app shell. The HUD banner portals into
 * `AppFrame`'s `DismissibleBannerPortalProvider` (full-bleed hosts) so it
 * stays in-flow. The sampler defaults to the browser wall adapter on the
 * injected timers; tests and harnesses pass their own.
 */

import type { PerfSampler } from '@libs/app-root-shared/types';
import { useTimers } from '@pkgs/clock-client/solid';
import { type JSX, untrack } from 'solid-js';
import {
  PerfHudPreferenceProvider,
  usePerfHudPreference,
} from './perf-hud-preference';
import { PerfSamplerProvider } from './perf-sampler-context';

function PerfHudGate(props: {
  readonly sampler: PerfSampler;
  readonly children: JSX.Element;
}): JSX.Element {
  const { enabled } = usePerfHudPreference();
  return (
    <PerfSamplerProvider sampler={props.sampler} active={enabled}>
      {props.children}
    </PerfSamplerProvider>
  );
}

export function PerfRoot(props: {
  readonly children: JSX.Element;
  /** Override for tests / harnesses; defaults to the wall sampler. */
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
