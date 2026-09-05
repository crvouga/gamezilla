/**
 * Persist HUD visibility via Kv (same pattern as theme preference).
 */

import { asKeyword } from '@pkgs/keyword/keyword';
import { booleanKvCodec } from '@pkgs/kv/kv-state-codec';
import { useKvState } from '@pkgs/kv/use-kv-state';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from 'react';

const PERF_HUD_ROW_KEY = asKeyword('ui.prefs/perf-hud-enabled');
const PERF_HUD_VALUE_ATTR = asKeyword('ui.prefs/value');
const PERF_HUD_CODEC = booleanKvCodec(PERF_HUD_VALUE_ATTR);

type PerfHudPreferenceContextValue = {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  toggle: () => void;
};

const PerfHudPreferenceContext =
  createContext<PerfHudPreferenceContextValue | null>(null);

export function PerfHudPreferenceProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [enabled, setEnabledState] = useKvState<boolean>({
    key: PERF_HUD_ROW_KEY,
    default: false,
    codec: PERF_HUD_CODEC,
  });

  const setEnabled = useCallback(
    (next: boolean) => {
      setEnabledState(next);
    },
    [setEnabledState]
  );

  const toggle = useCallback(() => {
    setEnabledState((prev) => !prev);
  }, [setEnabledState]);

  const value = useMemo(
    (): PerfHudPreferenceContextValue => ({ enabled, setEnabled, toggle }),
    [enabled, setEnabled, toggle]
  );

  return (
    <PerfHudPreferenceContext.Provider value={value}>
      {children}
    </PerfHudPreferenceContext.Provider>
  );
}

export function usePerfHudPreference(): PerfHudPreferenceContextValue {
  const ctx = useContext(PerfHudPreferenceContext);
  if (ctx === null) {
    throw new Error(
      'usePerfHudPreference must be used within PerfHudPreferenceProvider'
    );
  }
  return ctx;
}
