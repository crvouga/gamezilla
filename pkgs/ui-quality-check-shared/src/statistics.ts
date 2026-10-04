export interface ConfusionMatrix {
  readonly threshold: number;
  readonly truePositives: number;
  readonly falsePositives: number;
  readonly trueNegatives: number;
  readonly falseNegatives: number;
  readonly precision: number;
  readonly recall: number;
  readonly falsePositiveRate: number;
  readonly falseNegativeRate: number;
}

export function confusion(
  good: readonly number[],
  bad: readonly number[],
  threshold: number
): ConfusionMatrix {
  const truePositives = bad.filter((q) => q < threshold).length;
  const falsePositives = good.filter((q) => q < threshold).length;
  const trueNegatives = good.length - falsePositives;
  const falseNegatives = bad.length - truePositives;
  return {
    threshold,
    truePositives,
    falsePositives,
    trueNegatives,
    falseNegatives,
    precision:
      truePositives + falsePositives
        ? truePositives / (truePositives + falsePositives)
        : 0,
    recall: truePositives / bad.length,
    falsePositiveRate: falsePositives / good.length,
    falseNegativeRate: falseNegatives / bad.length,
  };
}

export function distribution(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (p: number) =>
    sorted[Math.floor((sorted.length - 1) * p)] ?? 0;
  return {
    count: values.length,
    min: quantile(0),
    p05: quantile(0.05),
    p25: quantile(0.25),
    median: quantile(0.5),
    p75: quantile(0.75),
    p95: quantile(0.95),
    max: quantile(1),
    mean: values.reduce((a, b) => a + b, 0) / values.length,
  };
}

export function candidateThresholds(
  good: readonly number[],
  bad: readonly number[]
): readonly number[] {
  const values = [...new Set([...good, ...bad])].sort((a, b) => a - b);
  return [
    0,
    ...values.slice(1).map((value, i) => ((values[i] ?? 0) + value) / 2),
    Math.min(1, (values.at(-1) ?? 0) + 0.000001),
  ];
}

export function calibrationStatistics(
  good: readonly number[],
  bad: readonly number[],
  maxFalsePositiveRate = 0.05
) {
  if (!good.length || !bad.length)
    throw new Error(
      'Calibration requires both known-good and known-bad images.'
    );
  if ([...good, ...bad].some((s) => !Number.isFinite(s) || s < 0 || s > 1))
    throw new Error(
      'Calibration scores must be finite numbers between 0 and 1.'
    );
  if (
    !Number.isFinite(maxFalsePositiveRate) ||
    maxFalsePositiveRate < 0 ||
    maxFalsePositiveRate > 1
  )
    throw new Error('maxFalsePositiveRate must be between 0 and 1.');
  const candidates = candidateThresholds(good, bad).map((threshold) =>
    confusion(good, bad, threshold)
  );
  const recommended = candidates
    .filter((c) => c.falsePositiveRate <= maxFalsePositiveRate)
    .sort(
      (a, b) =>
        b.recall - a.recall ||
        a.falsePositiveRate - b.falsePositiveRate ||
        a.threshold - b.threshold
    )[0];
  return {
    good: distribution(good),
    bad: distribution(bad),
    maxFalsePositiveRate,
    recommended: recommended && recommended.recall > 0 ? recommended : null,
    candidates,
  };
}
