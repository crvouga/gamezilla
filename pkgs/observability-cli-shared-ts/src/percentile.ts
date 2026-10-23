export function percentile(
  values: readonly number[],
  requested: number
): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((requested / 100) * sorted.length) - 1
  );
  return sorted[Math.max(0, index)] ?? 0;
}
