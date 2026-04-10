/** Numeric semver compare for x.y.z style versions (ignores prerelease suffix for the core). */
export function semverCompare(a: string, b: string): number {
  const pa = parseSemverCore(a);
  const pb = parseSemverCore(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da > db ? 1 : -1;
  }
  return 0;
}

/** True if `current` is the same or newer than `latest` (allows local previews). */
export function isAtLeastLatest(current: string, latest: string): boolean {
  return semverCompare(current, latest) >= 0;
}

function parseSemverCore(s: string): number[] {
  const core = (s.split(/[-+]/)[0] ?? s).trim();
  const parts = core.split('.');
  return parts.map((p) => {
    const n = parseInt(/^\d+/.exec(p)?.[0] ?? '', 10);
    return Number.isFinite(n) ? n : 0;
  });
}
