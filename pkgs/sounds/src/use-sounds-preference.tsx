import { asKeyword } from '@pkgs/keyword/keyword';
import { booleanKvCodec, jsonKvCodec } from '@pkgs/kv/kv-state-codec';
import { useKvState } from '@pkgs/kv/use-kv-state';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

const SOUNDS_MUTED_ROW_KEY = asKeyword('ui.prefs/sounds-muted');
const SOUNDS_MUTED_VALUE_ATTR = asKeyword('ui.prefs/value');
const SOUNDS_MUTED_CODEC = booleanKvCodec(SOUNDS_MUTED_VALUE_ATTR);

const SOUNDS_VOLUME_ROW_KEY = asKeyword('ui.prefs/sounds-master-volume');
const SOUNDS_VOLUME_VALUE_ATTR = asKeyword('ui.prefs/value');
const SOUNDS_VOLUME_CODEC = jsonKvCodec<number>(
  SOUNDS_VOLUME_VALUE_ATTR,
  (value): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
);

export type SoundsPreference = {
  readonly muted: boolean;
  readonly masterVolume: number;
  readonly setMuted: (next: boolean | ((prev: boolean) => boolean)) => void;
  readonly setMasterVolume: (
    next: number | ((prev: number) => number)
  ) => void;
};

const SoundsPreferenceContext = createContext<SoundsPreference | null>(null);

export type SoundsPreferenceProviderProps = {
  readonly children: ReactNode;
};

export function SoundsPreferenceProvider({
  children,
}: SoundsPreferenceProviderProps): ReactNode {
  const [muted, setMuted] = useKvState<boolean>({
    key: SOUNDS_MUTED_ROW_KEY,
    default: false,
    codec: SOUNDS_MUTED_CODEC,
  });
  const [masterVolume, setMasterVolume] = useKvState<number>({
    key: SOUNDS_VOLUME_ROW_KEY,
    default: 1,
    codec: SOUNDS_VOLUME_CODEC,
  });

  const value = useMemo(
    (): SoundsPreference => ({
      muted,
      masterVolume,
      setMuted,
      setMasterVolume,
    }),
    [masterVolume, muted, setMasterVolume, setMuted]
  );

  return (
    <SoundsPreferenceContext.Provider value={value}>
      {children}
    </SoundsPreferenceContext.Provider>
  );
}

export function useSoundsPreference(): SoundsPreference {
  const ctx = useContext(SoundsPreferenceContext);
  if (ctx === null) {
    throw new Error(
      'useSoundsPreference must be used within SoundsPreferenceProvider'
    );
  }
  return ctx;
}
