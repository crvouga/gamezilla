/** Fixed UTC stamp from an injected clock ms (no locale APIs). */
export function formatSnapshotStamp(ms: number): string {
  const iso = new Date(ms).toISOString();
  // 2026-08-16T16:42:08.123Z → 2026-08-16 16:42
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

/** Display title shown in chrome / session list (ignores legacy snap-* labels). */
export function formatSnapshotTitle(createdAtMs: number): string {
  return `Snapshot ${formatSnapshotStamp(createdAtMs)}`;
}

/** Relative age from injected now (e.g. `2m ago`). */
export function formatSnapshotAge(createdAtMs: number, nowMs: number): string {
  const sec = Math.max(0, Math.floor((nowMs - createdAtMs) / 1000));
  if (sec < 60) return `${String(sec)}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${String(min)}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${String(hr)}h ago`;
  const days = Math.floor(hr / 24);
  return `${String(days)}d ago`;
}

/** Human-readable ObjectStore byte size (B / KiB / MiB / GiB). */
export function formatSnapshotBytes(n: number): string {
  if (!(n >= 0) || !Number.isFinite(n)) return '0 B';
  if (n < 1024) return `${String(Math.round(n))} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KiB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MiB`;
  return `${(n / 1024 ** 3).toFixed(2)} GiB`;
}
