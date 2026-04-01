import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SegmentedControl } from '@gamezilla/shared/ui';

export type PatchdbAppMode = 'playground' | 'syncInspector';

const MODE_STORAGE_KEY = 'patch-db-app-mode';

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

const SEGMENTS = [
  { key: 'playground' as const, label: 'Playground' },
  { key: 'syncInspector' as const, label: 'Req Res' },
];

export function PatchdbAppNav({
  mode,
  onModeChange,
}: {
  mode: PatchdbAppMode;
  onModeChange: (mode: PatchdbAppMode) => void;
}) {
  useEffect(() => {
    void AsyncStorage.getItem(MODE_STORAGE_KEY).then((raw) => {
      if (raw === 'syncInspector' || raw === 'playground') {
        if (raw !== mode) onModeChange(raw);
      }
    });
  }, []);

  return (
    <SegmentedControl
      segments={SEGMENTS}
      selected={mode}
      onSelect={(key) => {
        persistMode(key);
        onModeChange(key);
      }}
    />
  );
}
