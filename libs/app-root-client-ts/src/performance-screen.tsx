/** @jsxImportSource solid-js */
/**
 * `/more/performance` — toggles the perf HUD top banner (`PerfRoot`) and
 * shows the live sampler metrics while it is on.
 */

import type { JSX } from 'solid-js';
import { usePerfHudPreference } from './perf-hud-preference';
import { createPerfSnapshot } from './perf-sampler-context';
import { PerformanceSettingsScreenView } from './performance-screen-view';

/** `/more/performance`: wires the view to the HUD preference and sampler. */
export function PerformanceSettingsScreen(): JSX.Element {
  const { enabled, setEnabled } = usePerfHudPreference();
  // Subscribes only while the monitor is on, so a hidden HUD costs nothing.
  const snap = createPerfSnapshot(enabled);
  return (
    <PerformanceSettingsScreenView
      enabled={enabled()}
      metrics={snap()}
      onEnabledChange={setEnabled}
    />
  );
}
