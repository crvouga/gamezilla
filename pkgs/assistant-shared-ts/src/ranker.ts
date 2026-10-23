export function pickWeightedIndex(
  weights: readonly number[],
  rngU01: () => number
): number {
  let sum = 0;
  for (const w of weights) {
    sum += w;
  }
  if (sum <= 0) return -1;
  let t = rngU01() * sum;
  for (let i = 0; i < weights.length; i += 1) {
    t -= weights[i] ?? 0;
    if (t <= 0) return i;
  }
  return weights.length - 1;
}
