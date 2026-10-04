import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { createUIQualityChecker } from '@pkgs/ui-quality-check-server/api';
import { calibrate } from '@pkgs/ui-quality-check-server/calibrate';
import {
  calibrationStatistics,
  confusion,
} from '@pkgs/ui-quality-check-shared/statistics';
import fc from 'fast-check';
import { detector, options, rgb } from './support';

test('calibration chooses a measured threshold and reports confusion counts', () => {
  const report = calibrationStatistics([0.8, 0.9], [0.1, 0.2]);
  expect(report.recommended?.threshold).toBe(0.5);
  expect(report.recommended?.truePositives).toBe(2);
  expect(report.recommended?.falsePositives).toBe(0);
  expect(report.good.median).toBe(0.8);
  expect(report.bad.max).toBe(0.2);
});

test('a corpus with no discriminative signal produces no recommended gate', () => {
  expect(calibrationStatistics([0.7], [0.7]).recommended).toBeNull();
  expect(() => calibrationStatistics([], [0.3])).toThrow('both known-good');
  expect(() => calibrationStatistics([Infinity], [0.3])).toThrow('finite');
});

test('threshold statistics are monotone and conserve sample counts', () => {
  assertProperty(
    'threshold statistics',
    fc.property(
      fc.array(fc.integer({ min: 0, max: 100 }), {
        minLength: 1,
        maxLength: 30,
      }),
      fc.array(fc.integer({ min: 0, max: 100 }), {
        minLength: 1,
        maxLength: 30,
      }),
      (g, b) => {
        const good = g.map((x) => x / 100);
        const bad = b.map((x) => x / 100);
        const low = confusion(good, bad, 0.25);
        const high = confusion(good, bad, 0.75);
        expect(high.truePositives).toBeGreaterThanOrEqual(low.truePositives);
        expect(high.falsePositives).toBeGreaterThanOrEqual(low.falsePositives);
        expect(high.truePositives + high.falseNegatives).toBe(bad.length);
        expect(high.trueNegatives + high.falsePositives).toBe(good.length);
      }
    )
  );
});

test('programmatic calibration reuses a supplied checker and emits serializable configuration', async () => {
  const model = detector();
  const checker = await createUIQualityChecker(options(model.value));
  try {
    const report = await calibrate({
      good: [rgb(250), rgb(220)],
      bad: [rgb(20), rgb(40)],
      checker,
      clock: { now: () => 0 },
    });
    expect(report.recommended?.recall).toBe(1);
    expect(report.configuration?.detectorVersions[0]?.version).toBe('1');
    expect(JSON.parse(JSON.stringify(report.configuration)).threshold).toBe(
      report.recommended?.threshold
    );
    expect(model.initialized()).toBe(1);
    expect(model.disposed()).toBe(0);
    if (!report.configuration)
      throw new Error('Expected calibrated configuration.');
    const configured = await createUIQualityChecker({
      ...options(detector().value),
      ...report.configuration,
    });
    try {
      expect((await configured.checkImage(rgb(250))).pass).toBe(true);
    } finally {
      await configured.dispose();
    }
  } finally {
    await checker.dispose();
  }
});

test('calibrated detector versions cannot silently drift', async () => {
  const model = detector();
  await expect(
    createUIQualityChecker({
      ...options(model.value),
      detectorVersions: [
        {
          id: 'fixture-score',
          version: 'different',
          executionProvider: 'in-process',
        },
      ],
    })
  ).rejects.toThrow('Calibration detector version/provider');
  expect(model.disposed()).toBe(1);
});
