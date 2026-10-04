/** @jsxImportSource solid-js */
/**
 * Wires preference + sampler under the app shell. The HUD banner portals into
 * `AppFrame`'s `DismissibleBannerPortalProvider` (full-bleed hosts) so it
 * stays in-flow. The sampler defaults to the browser wall adapter on the
 * injected timers; tests and harnesses pass their own.
 */

import { useTimers } from '@pkgs/clock-client/solid';
import { type JSX, untrack } from 'solid-js';

import { createLazyPerfSampler } from '@libs/app-shared/create-lazy-perf-sampler';
import {
  PerfHudPreferenceProvider,
  usePerfHudPreference,
} from './perf-hud-preference';
import { PerfSamplerProvider } from './perf-sampler-context';
import type { PerfSampler } from '@libs/app-shared/types';

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
    untrack(() => props.sampler) ??
    createLazyPerfSampler(async () => {
      const { createWallPerfSampler } = await import('./wall');
      return createWallPerfSampler({ timers });
    });
  return (
    <PerfHudPreferenceProvider>
      <PerfHudGate sampler={sampler}>{props.children}</PerfHudGate>
    </PerfHudPreferenceProvider>
  );
}
