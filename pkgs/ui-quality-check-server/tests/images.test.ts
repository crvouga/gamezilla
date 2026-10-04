import { expect, test } from 'bun:test';
import {
  assertImageQuality,
  assertImagesQuality,
  checkImages,
  createUIQualityChecker,
} from '@pkgs/ui-quality-check-server/api';
import { UIQualityError } from '@pkgs/ui-quality-check-shared/errors';
import { detector, options, rgb } from './support';

test('RGB inputs use bounded inference batches and preserve input order', async () => {
  const model = detector();
  const result = await checkImages(
    [rgb(250), rgb(20), rgb(220), rgb(230), rgb(10)],
    { ...options(model.value), batchSize: 2 }
  );
  expect(result.results.map((r) => r.pass)).toEqual([
    true,
    false,
    true,
    true,
    false,
  ]);
  expect(model.calls).toEqual([2, 2, 1]);
  expect(model.initialized()).toBe(1);
  expect(model.disposed()).toBe(1);
  expect(result.results[1]?.worstScore).toBe(0.078431);
  expect(result.results[1]?.schemaVersion).toBe(1);
});

test('assertions carry the quality evidence and only reject quality failures', async () => {
  await expect(
    assertImageQuality(rgb(250), options(detector().value))
  ).resolves.toBeUndefined();
  await expect(
    assertImageQuality(rgb(20), options(detector().value))
  ).rejects.toBeInstanceOf(UIQualityError);
  await expect(
    assertImagesQuality([rgb(250), rgb(20)], options(detector().value))
  ).rejects.toThrow('1 of 2 inputs failed');
});

test('initialized checkers reuse the detector and reject calls after disposal', async () => {
  const model = detector();
  const checker = await createUIQualityChecker(options(model.value));
  const first = await checker.checkImage(rgb(20));
  const second = await checker.checkImage(rgb(20));
  expect(first).toEqual(second);
  expect(model.initialized()).toBe(1);
  expect(checker.metrics().scoringMs).toBe(0);
  await checker.dispose();
  await checker.dispose();
  expect(model.disposed()).toBe(1);
  await expect(checker.checkImage(rgb(250))).rejects.toThrow('disposed');
});

test('corrupt images, malformed RGB and empty batches fail as tooling errors', async () => {
  const checker = await createUIQualityChecker(options(detector().value));
  try {
    await expect(checker.checkImage(new Uint8Array([1, 2, 3]))).rejects.toThrow(
      'Cannot decode image'
    );
    await expect(
      checker.checkImage({ width: 0, height: 10, data: new Uint8Array() })
    ).rejects.toThrow('RGB image');
    await expect(checker.checkImages([])).rejects.toThrow('at least one image');
  } finally {
    await checker.dispose();
  }
});

test('each required detector participates in the verdict', async () => {
  const good = detector('good');
  const bad = detector('bad');
  bad.value.score = async (images) =>
    images.map(() => ({ quality: 0.1, evidence: 'Broken layout' }));
  const checker = await createUIQualityChecker({
    ...options(good.value),
    detectors: [good.value, bad.value],
  });
  try {
    const result = await checker.checkImage(rgb(250));
    expect(result.pass).toBe(false);
    expect(result.detectors.map((d) => d.pass)).toEqual([true, false]);
    expect(result.frames[0]?.detectorScores[1]?.evidence).toBe('Broken layout');
  } finally {
    await checker.dispose();
  }
});

test('invalid detector output cannot silently pass', async () => {
  const model = detector();
  model.value.score = async () => [];
  const checker = await createUIQualityChecker(options(model.value));
  try {
    await expect(checker.checkImage(rgb(250))).rejects.toThrow('one finite');
  } finally {
    await checker.dispose();
  }
});

test('initialization failure releases every detector', async () => {
  const first = detector('first');
  const second = detector('second');
  second.value.initialize = async () => {
    throw new Error('backend unavailable');
  };
  await expect(
    createUIQualityChecker({ detectors: [first.value, second.value] })
  ).rejects.toThrow('backend unavailable');
  expect(first.disposed()).toBe(1);
  expect(second.disposed()).toBe(1);
});

test('configuration is validated before allocating model resources', async () => {
  const model = detector();
  for (const setting of [
    { threshold: NaN },
    { threshold: 1.1 },
    { batchSize: 0 },
    { concurrency: 1.5 },
    { samplingFps: 0 },
    { dedupeThreshold: -1 },
    { failureClipMs: -1 },
    { ignoreRegions: [{ startMs: 4, endMs: 2 }] },
  ]) {
    await expect(
      createUIQualityChecker({ ...options(model.value), ...setting })
    ).rejects.toThrow();
  }
  expect(model.initialized()).toBe(0);
});
