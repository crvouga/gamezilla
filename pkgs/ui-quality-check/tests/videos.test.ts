import { expect, test } from 'bun:test';
import {
  assertVideoQuality,
  checkVideos,
  createUIQualityChecker,
} from 'ui-quality-check';
import { decoder, detector, options, rgb } from './support';

const frames = (values: readonly number[]) =>
  values.map((value, index) => ({
    timestampMs: index * 250,
    image: rgb(value),
  }));

test('static video frames reuse scores while retaining exact candidate timestamps', async () => {
  const model = detector();
  const decode = decoder(frames([250, 250, 250, 20, 20, 250]));
  const checker = await createUIQualityChecker({
    ...options(model.value, decode.value),
    batchSize: 2,
  });
  try {
    const result = await checker.checkVideo('trace.webm');
    expect(result.pass).toBe(false);
    expect(result.candidateFrames).toBe(6);
    expect(result.framesAnalyzed).toBe(3);
    expect(result.framesDeduplicated).toBe(3);
    expect(result.worstFrames[0]?.timestampMs).toBe(750);
    expect(result.worstFrames).toHaveLength(1);
    expect(
      result.worstFrames.every((frame) => frame.quality < result.threshold)
    ).toBe(true);
    expect(result.frames.map((f) => f.timestampMs)).toEqual([
      0, 250, 500, 750, 1000, 1250,
    ]);
    expect(model.calls).toEqual([2, 1]);
    expect(decode.closed()).toBe(1);
  } finally {
    await checker.dispose();
  }
});

test('confirmed aggregation suppresses an isolated score but retains persistent failures', async () => {
  const isolated = decoder(frames([250, 20, 250]));
  const checker = await createUIQualityChecker({
    ...options(detector().value, isolated.value),
    aggregation: 'confirmed',
  });
  try {
    const result = await checker.checkVideo('trace.webm');
    expect(result.pass).toBe(true);
    expect(result.worstScore).toBe(0.078431);
    expect(result.failures).toHaveLength(0);
  } finally {
    await checker.dispose();
  }
  const persistent = decoder(frames([250, 20, 20, 250]));
  await expect(
    assertVideoQuality('trace.webm', {
      ...options(detector().value, persistent.value),
      aggregation: 'confirmed',
    })
  ).rejects.toThrow('failed');
});

test('empty edges are transparent exclusions, while interior empty UI fails', async () => {
  const empty = { data: new Uint8Array(64 * 64 * 3), width: 64, height: 64 };
  const edge = decoder([
    { timestampMs: 0, image: empty },
    { timestampMs: 250, image: rgb(250) },
    { timestampMs: 500, image: empty },
  ]);
  const checker = await createUIQualityChecker(
    options(detector().value, edge.value)
  );
  try {
    const result = await checker.checkVideo('launch.webm');
    expect(result.pass).toBe(true);
    expect(result.framesSkippedEmpty).toBe(2);
  } finally {
    await checker.dispose();
  }
  const interior = decoder([
    { timestampMs: 0, image: rgb(250) },
    { timestampMs: 250, image: empty },
    { timestampMs: 500, image: rgb(250) },
  ]);
  const next = await createUIQualityChecker(
    options(detector().value, interior.value)
  );
  try {
    const result = await next.checkVideo('launch.webm');
    expect(result.pass).toBe(false);
    expect(result.worstScore).toBe(0);
    expect(result.worstFrames[0]?.timestampMs).toBe(250);
    expect(
      result.detectors.some((model) => model.id === 'empty-ui' && !model.pass)
    ).toBe(true);
  } finally {
    await next.dispose();
  }
});

test('an entirely blank or excluded recording cannot establish a pass', async () => {
  const empty = { data: new Uint8Array(64 * 64 * 3), width: 64, height: 64 };
  const checker = await createUIQualityChecker(
    options(detector().value, decoder([{ timestampMs: 0, image: empty }]).value)
  );
  try {
    await expect(checker.checkVideo('blank.webm')).rejects.toThrow(
      'No usable UI frames'
    );
  } finally {
    await checker.dispose();
  }
  const excluded = await createUIQualityChecker({
    ...options(detector().value, decoder(frames([20, 20])).value),
    ignoreRegions: [{ startMs: 0, endMs: 1000 }],
  });
  try {
    await expect(excluded.checkVideo('blank.webm')).rejects.toThrow(
      'No usable UI frames'
    );
  } finally {
    await excluded.dispose();
  }
});

test('decoder failures and aborted checks close the iterator', async () => {
  const abort = new AbortController();
  let closed = false;
  const checker = await createUIQualityChecker({
    ...options(detector().value),
    signal: abort.signal,
    batchSize: 1,
    decoder: {
      version: 'abort-fixture',
      async open() {
        return {
          durationMs: 1000,
          frames: (async function* () {
            try {
              yield { ...rgb(250), timestampMs: 0 };
              abort.abort(new Error('cancelled'));
              yield { ...rgb(20), timestampMs: 250 };
            } finally {
              closed = true;
            }
          })(),
        };
      },
    },
  });
  try {
    await expect(checker.checkVideo('trace.webm')).rejects.toThrow('cancelled');
    expect(closed).toBe(true);
  } finally {
    await checker.dispose();
  }
  const failure = await createUIQualityChecker({
    ...options(detector().value),
    decoder: {
      version: 'corrupt',
      async open() {
        throw new Error('Corrupt video');
      },
    },
  });
  try {
    await expect(failure.checkVideo('bad.webm')).rejects.toThrow(
      'Corrupt video'
    );
  } finally {
    await failure.dispose();
  }
});

test('video concurrency is bounded and shares one initialized model', async () => {
  const model = detector();
  const decode = decoder(frames([250, 20]));
  const result = await checkVideos(
    ['one.webm', 'two.mp4', 'three.webm', 'four.mp4'],
    { ...options(model.value, decode.value), concurrency: 2 }
  );
  expect(result.results.length).toBe(4);
  expect(decode.peak()).toBeLessThanOrEqual(2);
  expect(model.initialized()).toBe(1);
  expect(model.disposed()).toBe(1);
});
