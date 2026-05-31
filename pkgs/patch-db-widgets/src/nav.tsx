import { useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SegmentedControl } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';

export type PatchdbAppMode = 'playground' | 'syncInspector';

const MODE_STORAGE_KEY = 'patch-db-widgets-mode';

let cachedMode: PatchdbAppMode = 'playground';

export function readStoredMode(): PatchdbAppMode {
  return cachedMode;
}

export function loadStoredMode(): void {
  void AsyncStorage.getItem(MODE_STORAGE_KEY).then((raw) => {
    if (raw === 'syncInspector' || raw === 'playground') {
      cachedMode = raw;
    }
  });
}

export function persistMode(mode: PatchdbAppMode): void {
  cachedMode = mode;
  void AsyncStorage.setItem(MODE_STORAGE_KEY, mode);
}

loadStoredMode();

export function PatchdbAppNav({
  mode,
  onModeChange,
}: {
  mode: PatchdbAppMode;
  onModeChange: (mode: PatchdbAppMode) => void;
}) {
  const { t } = useLingui();
  const segments = useMemo(
    () => [
      { key: 'playground' as const, label: t`Playground` },
      { key: 'syncInspector' as const, label: t`Req Res` },
    ],
    [t]
  );

  useEffect(() => {
    void AsyncStorage.getItem(MODE_STORAGE_KEY).then((raw) => {
      if (raw === 'syncInspector' || raw === 'playground') {
        if (raw !== mode) onModeChange(raw);
      }
    });
  }, [mode, onModeChange]);

  return (
    <SegmentedControl
      segments={segments}
      selected={mode}
      onSelect={(key) => {
        persistMode(key);
        onModeChange(key);
      }}
    />
  );
}
