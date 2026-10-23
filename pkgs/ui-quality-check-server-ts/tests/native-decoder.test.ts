import { expect, test } from 'bun:test';
import { createUIQualityChecker } from '@pkgs/ui-quality-check-server-ts/api';
import { detector, options } from './support';

test('fixed FPS sampling retains source timestamps without accumulated rounding drift', async () => {
  // regression: ui-quality-fixed-fps-drift — literal 30 FPS, 50 s source at 4 FPS.
  const checker = await createUIQualityChecker({
    ...options(detector('fixture', 0.8).value),
    samplingFps: 4,
  });
  try {
    const result = await checker.checkVideo('fixtures/codecs/grid-30fps.webm');
    expect(result.candidateFrames).toBe(200);
    expect(result.durationMs).toBe(50_000);
    expect(result.framesAnalyzed).toBe(1);
    expect(result.framesDeduplicated).toBe(199);
    expect(result.frames.slice(0, 8).map((frame) => frame.timestampMs)).toEqual(
      [0, 267, 500, 767, 1000, 1267, 1500, 1767]
    );
    expect(result.frames.at(-1)?.timestampMs).toBe(49_767);
  } finally {
    await checker.dispose();
  }
});

test('aborting during native inference closes the running FFmpeg decoder', async () => {
  const cancellation = new AbortController();
  const model = detector();
  model.value.score = async (images) => {
    cancellation.abort(new Error('stop native decoder'));
    return images.map(() => ({ quality: 0.8 }));
  };
  const checker = await createUIQualityChecker({
    ...options(model.value),
    signal: cancellation.signal,
    batchSize: 1,
  });
  try {
    await expect(
      checker.checkVideo('fixtures/codecs/grid-30fps.webm')
    ).rejects.toThrow('stop native decoder');
  } finally {
    await checker.dispose();
  }
});

test('a missing FFmpeg executable explains how to repair installation', async () => {
  const checker = await createUIQualityChecker({
    ...options(detector().value),
    ffmpegPath: 'ui-quality-nonexistent-ffmpeg',
  });
  try {
    await expect(
      checker.checkVideo('fixtures/codecs/grid-30fps.webm')
    ).rejects.toThrow('Enable installation scripts');
  } finally {
    await checker.dispose();
  }
});

test('a real corrupt recording returns decoder diagnostics instead of a quality verdict', async () => {
  const checker = await createUIQualityChecker(options(detector().value));
  try {
    await expect(
      checker.checkVideo('fixtures/codecs/corrupt.webm')
    ).rejects.toThrow('FFmpeg failed');
  } finally {
    await checker.dispose();
  }
});

test('failure artifacts retain the inspected frame when source timestamps round upward', async () => {
  // regression: ui-quality-artifact-rounded-timestamp — 60 FPS MP4, black frame at 16.666… ms.
  const checker = await createUIQualityChecker({
    ...options(detector().value),
    samplingFps: 60,
    ignoreEmptyFrames: false,
    artifactsDir: '.cache/codec-artifacts',
  });
  try {
    const result = await checker.checkVideo(
      'fixtures/codecs/rounded-timestamp.mp4'
    );
    expect(result.worstFrames[0]?.timestampMs).toBe(17);
    const artifact = result.worstFrames[0]?.artifact;
    if (!artifact) throw new Error('Expected a failure PNG.');
    expect((await checker.checkImage(artifact)).score).toBe(0);
  } finally {
    await checker.dispose();
  }
});
