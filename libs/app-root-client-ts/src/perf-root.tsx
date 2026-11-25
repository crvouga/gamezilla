import { createWallPerfSampler } from './wall';
/** @jsxImportSource @solidjs/web */
/**
 * Wires preference + sampler under the app shell. The HUD banner portals into
 * `AppFrame`'s `DismissibleBannerPortalProvider` (full-bleed hosts) so it
 * stays in-flow. The sampler defaults to the browser wall adapter on the
 * injected timers; tests and harnesses pass their own.
 */

import type { PerfSampler } from '@libs/app-root-shared-ts/types';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import type { JSX } from '@solidjs/web';
import { untrack } from 'solid-js';
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
