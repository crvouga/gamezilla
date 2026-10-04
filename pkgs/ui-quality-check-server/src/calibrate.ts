// @io-wall-ok — programmatic calibration composition root.

import type { ImageInput } from '@pkgs/ui-quality-check-shared/detectors-types';
import { calibrationStatistics } from '@pkgs/ui-quality-check-shared/statistics';
import type {
  CheckerOptions,
  UIQualityChecker,
} from '@pkgs/ui-quality-check-shared/ui-quality-check-types';
import { createUIQualityChecker } from './api';
import { localClock } from './wall-io';

export interface CalibrationOptions {
  readonly good: readonly ImageInput[];
  readonly bad: readonly ImageInput[];
  readonly maxFalsePositiveRate?: number;
  readonly checker?: UIQualityChecker;
  readonly options?: CheckerOptions;
  readonly clock?: { readonly now: () => number };
}

export async function calibrate(options: CalibrationOptions) {
  if (!options.good.length || !options.bad.length)
    throw new Error(
      'Calibration requires both known-good and known-bad screenshots.'
    );
  const checker =
    options.checker ?? (await createUIQualityChecker(options.options));
  try {
    const good = await checker.checkImages(options.good);
    const bad = await checker.checkImages(options.bad);
    const statistics = calibrationStatistics(
      good.results.map((r) => r.worstScore),
      bad.results.map((r) => r.worstScore),
      options.maxFalsePositiveRate
    );
    const configuration = statistics.recommended
      ? {
          schemaVersion: 1 as const,
          threshold: statistics.recommended.threshold,
          detectorVersions: checker.detectors,
          ...(checker.detectors.length === 1 &&
          checker.detectors[0]?.id === 'UIClip'
            ? {
                provider: checker.detectors[0].executionProvider as NonNullable<
                  CheckerOptions['provider']
                >,
              }
            : {}),
          ...(options.options?.batchSize
            ? { batchSize: options.options.batchSize }
            : {}),
          model: checker.detectors.map((d) => d.id).join('+'),
          modelVersion: checker.detectors.map((d) => d.version).join('+'),
          calibratedAt: new Date(
            (options.clock ?? options.options?.clock ?? localClock).now()
          ).toISOString(),
          aggregation: 'minimum' as const,
        }
      : null;
    return {
      schemaVersion: 1 as const,
      ...statistics,
      configuration,
      samples: {
        good: good.results.map((r) => ({
          input: r.input,
          score: r.worstScore,
        })),
        bad: bad.results.map((r) => ({ input: r.input, score: r.worstScore })),
      },
    };
  } finally {
    if (!options.checker) await checker.dispose();
  }
}
