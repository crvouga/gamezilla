import { expect, test } from 'bun:test';
import { createUIQualityChecker } from '@pkgs/ui-quality-check-server-ts/api';
import { decoder, detector, options, rgb } from './support';

test('dispose waits for already-started directory work and shares pending cleanup', async () => {
  // regression: ui-quality-dispose-active-check
  const model = detector();
  const checker = await createUIQualityChecker(options(model.value));
  const checking = checker.check(['fixtures/evaluation/good']);
  const firstDisposal = checker.dispose();
  const secondDisposal = checker.dispose();
  expect(firstDisposal).toBe(secondDisposal);
  expect((await checking).results.length).toBe(8);
  await Promise.all([firstDisposal, secondDisposal]);
  expect(model.disposed()).toBe(1);
});

test('concurrent individual video calls share the checker concurrency limit', async () => {
  const decode = decoder(
    [0, 250, 500].map((timestampMs) => ({
      timestampMs,
      image: rgb(timestampMs ? 20 : 250),
    }))
  );
  const checker = await createUIQualityChecker({
    ...options(detector().value, decode.value),
    concurrency: 2,
  });
  try {
    await Promise.all(
      ['one.webm', 'two.webm', 'three.webm', 'four.webm', 'five.webm'].map(
        (path) => checker.checkVideo(path)
      )
    );
    expect(decode.peak()).toBeLessThanOrEqual(2);
    expect(decode.closed()).toBe(5);
  } finally {
    await checker.dispose();
  }
});
