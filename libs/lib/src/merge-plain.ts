/**
 * Shallow-merge plain objects (own enumerable string keys). Later arguments win.
 * Highly optimized for small PatchDB attribute maps.
 */
export function mergePlain(
  ...parts: Record<string, unknown>[]
): Record<string, unknown> {
  const len = parts.length;
  if (len === 0) return {};
  if (len === 1) return { ...parts[0] };
  if (len === 2) {
    const part0 = parts[0]!;
    const part1 = parts[1]!;
    const out: Record<string, unknown> = {};
    copyOwnEnumerableStringKeys(part0, out);
    copyOwnEnumerableStringKeys(part1, out);
    return out;
  }
  // Fallback for 3+ args: avoid spread and Object.assign for hot-path perf.
  const out: Record<string, unknown> = {};
  for (let i = 0; i < len; ++i) {
    copyOwnEnumerableStringKeys(parts[i]!, out);
  }
  return out;
}

function copyOwnEnumerableStringKeys(
  source: Record<string, unknown>,
  target: Record<string, unknown>
): void {
  for (const k in source) {
    if (Object.prototype.hasOwnProperty.call(source, k)) {
      target[k] = source[k];
    }
  }
}
