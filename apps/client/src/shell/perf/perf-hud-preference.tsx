/** @jsxImportSource solid-js */
/**
 * Persisted HUD visibility via Kv (`createKvState`, same pattern as the
 * theme preference). Off by default.
 */

import { asKeyword } from '@pkgs/keyword/keyword';
import { booleanKvCodec } from '@pkgs/kv/kv-state-codec';
import { createKvState } from '@pkgs/kv/solid';
import { defineContext } from '@pkgs/solid-context/define-context';
import type { Accessor, JSX } from 'solid-js';

const PERF_HUD_ROW_KEY = asKeyword('ui.prefs/perf-hud-enabled');
const PERF_HUD_VALUE_ATTR = asKeyword('ui.prefs/value');
const PERF_HUD_CODEC = booleanKvCodec(PERF_HUD_VALUE_ATTR);

export type PerfHudPreference = {
  readonly enabled: Accessor<boolean>;
  readonly setEnabled: (next: boolean) => void;
  readonly toggle: () => void;
};

const PerfHudPreferenceContext =
  defineContext<PerfHudPreference>('PerfHudPreference');

export function PerfHudPreferenceProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const [enabled, setEnabledState] = createKvState<boolean>({
    key: PERF_HUD_ROW_KEY,
    default: false,
    codec: PERF_HUD_CODEC,
  });
  const value: PerfHudPreference = {
    enabled,
    setEnabled: (next) => setEnabledState(next),
    toggle: () => setEnabledState((prev) => !prev),
  };
  return (
    <PerfHudPreferenceContext.Provider value={value}>
      {props.children}
    </PerfHudPreferenceContext.Provider>
  );
}

export function usePerfHudPreference(): PerfHudPreference {
  return PerfHudPreferenceContext.use();
}
