export type PatchdbAppMode = 'playground' | 'syncInspector';

const MODE_STORAGE_KEY = 'patch-db-app-mode';

export function readStoredMode(): PatchdbAppMode {
  try {
    const raw = localStorage.getItem(MODE_STORAGE_KEY);
    if (raw === 'syncInspector' || raw === 'playground') return raw;
  } catch {
    /* ignore */
  }
  return 'playground';
}

export function persistMode(mode: PatchdbAppMode): void {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function PatchdbAppNav({
  mode,
  onModeChange,
}: {
  mode: PatchdbAppMode;
  onModeChange: (mode: PatchdbAppMode) => void;
}) {
  return (
    <nav className="flex shrink-0 gap-1 border-b border-white/10 bg-black/20 px-4 py-2">
      <button
        type="button"
        onClick={() => {
          persistMode('playground');
          onModeChange('playground');
        }}
        className={
          mode === 'playground'
            ? 'rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white'
            : 'rounded-lg px-3 py-1.5 text-xs font-semibold text-white/45 transition-colors hover:bg-white/8 hover:text-white/75'
        }
      >
        Patch DB simulator playground
      </button>
      <button
        type="button"
        onClick={() => {
          persistMode('syncInspector');
          onModeChange('syncInspector');
        }}
        className={
          mode === 'syncInspector'
            ? 'rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white'
            : 'rounded-lg px-3 py-1.5 text-xs font-semibold text-white/45 transition-colors hover:bg-white/8 hover:text-white/75'
        }
      >
        Req Res
      </button>
    </nav>
  );
}
