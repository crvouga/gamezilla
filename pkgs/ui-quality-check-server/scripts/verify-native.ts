// @io-wall-ok — automated offline decoder/model/CLI contract rehearsal.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startProcess } from '@pkgs/os-server/streaming-process';
import ffmpeg from 'ffmpeg-static';
import type { BatchQualityResult } from '@pkgs/ui-quality-check-shared/ui-quality-check-types';
import { createUIQualityChecker } from '@pkgs/ui-quality-check-server/api';

const runtime = process.argv[2] ?? process.execPath;
const recording = resolve('.cache/benchmark-videos/recording-0.webm');
const artifacts = resolve('.cache/verified-artifacts');
const checker = await createUIQualityChecker({
  threshold: 0.534143,
  artifactsDir: artifacts,
  failureClipMs: 1000,
});
try {
  const first = await checker.checkVideo(recording);
  const second = await checker.checkVideo(recording);
  assert.deepEqual(
    first,
    second,
    'repeated checks must produce identical quality evidence'
  );
  assert.equal(first.pass, false);
  assert.equal(first.durationMs, 50_000);
  // regression: ui-quality-fixed-fps-drift — literal 30 FPS, 50 s source at 4 FPS.
  assert.equal(first.candidateFrames, 200);
  assert.equal(first.framesAnalyzed, 3);
  assert.equal(first.worstFrames.length, 1);
  const worst = first.worstFrames[0];
  assert(worst && worst.timestampMs >= 24_500 && worst.timestampMs < 25_500);
  assert(worst.artifact && worst.clip);
  assert.deepEqual(
    [...(await readFile(worst.artifact)).subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10]
  );
  const clip = await capture(ffmpeg ?? 'ffmpeg', [
    '-hide_banner',
    '-i',
    worst.clip,
    '-frames:v',
    '1',
    '-f',
    'null',
    '-',
  ]);
  assert.equal(clip.code, 0);
  assert.match(clip.stderr, /Duration: 00:00:01\.00/);
  const persisted = JSON.parse(
    await readFile(resolve(worst.artifact, '../result.json'), 'utf8')
  );
  assert.deepEqual(persisted, first);
} finally {
  await checker.dispose();
}
await verifyCli();
process.stdout.write(
  'Offline native contracts passed: fixed sampling, deterministic inference, exact failure timestamps, PNG/context artifacts, CLI JSON and exit codes.\n'
);

async function capture(command: string, args: readonly string[]) {
  const child = startProcess({ command, args });
  const read = async (stream: AsyncIterable<Uint8Array>) => {
    const parts: Uint8Array[] = [];
    for await (const part of stream) parts.push(part);
    return Buffer.concat(parts).toString();
  };
  try {
    const [stdout, stderr, code] = await Promise.all([
      read(child.stdout),
      read(child.stderr),
      child.completed,
    ]);
    return { stdout, stderr, code };
  } finally {
    child.stop();
    await child.completed;
  }
}

async function cli(args: readonly string[]) {
  const result = await capture(runtime, ['dist/cli.js', ...args, '--json']);
  assert.equal(
    result.stderr,
    '',
    'CLI JSON mode must keep stdout machine-readable'
  );
  return { code: result.code, value: JSON.parse(result.stdout) };
}

async function verifyCli() {
  const good = await cli([
    'image',
    'fixtures/evaluation/good/desktop.png',
    '--threshold',
    '0.534143',
  ]);
  assert.equal(good.code, 0);
  assert.equal(good.value.pass, true);
  const bad = await cli(['video', recording, '--threshold', '0.534143']);
  assert.equal(bad.code, 1);
  assert.equal(
    (bad.value as BatchQualityResult).results[0]?.candidateFrames,
    200
  );
  const batch = await cli([
    'image',
    'fixtures/evaluation/good/*.png',
    '--threshold',
    '0',
  ]);
  assert.equal(batch.code, 0);
  assert.equal(batch.value.results.length, 8);
  const directory = await cli(['fixtures/evaluation/good', '--threshold', '0']);
  assert.deepEqual(directory.value, batch.value);
  const absent = await cli([
    'image',
    'fixtures/evaluation/good/desktop.png',
    '--model-dir',
    '.cache/absent-model',
  ]);
  assert.equal(absent.code, 2);
  assert.match(absent.value.error.message, /setup/);
  await writeFile('.cache/corrupt.webm', 'not a video');
  const corrupt = await cli(['video', '.cache/corrupt.webm']);
  assert.equal(corrupt.code, 2);
  assert.match(corrupt.value.error.message, /FFmpeg failed/);
  const unsupported = await cli(['image', 'fixtures/corpus.json']);
  assert.equal(unsupported.code, 2);
  const help = await cli(['--help']);
  assert.equal(help.code, 0);
  assert.equal(help.value.schemaVersion, 1);
}
