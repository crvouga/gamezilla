// @io-wall-ok — the hosted journey writes synthetic browser evidence and runs its video encoder.
import { join } from 'node:path';
import type { OpeningResult } from '@libs/runtime-harness-ts/journey-types';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import { writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { run } from '@pkgs/os-server-ts/command';
import type { ScreencastFrame } from '@pkgs/ui-testing-bun-webview-server-ts/chrome-screencast';
import ffmpeg from 'ffmpeg-static';
import type { Device } from './live-browser';
import { EVIDENCE_DIR } from './live-browser';

type Result = Extract<OpeningResult, { kind: 'browser' }>;
type Profile = 'fresh' | 'returning';

async function screenshot(device: Device): Promise<string> {
  const frame = await device.view.cdp<{ data: string }>(
    'Page.captureScreenshot',
    {
      format: 'jpeg',
      quality: 90,
    }
  );
  return frame.data;
}

async function saveVideo(
  profile: Profile,
  frames: readonly ScreencastFrame[],
  result: Result
): Promise<void> {
  const directory = join(EVIDENCE_DIR, `opening-${profile}`, 'steps');
  const store = createNodeFsObjectStore({
    rootDir: directory,
    fs: wallNodeFs(),
    layout: 'tree',
  });
  const files: string[] = [];
  const timeline: string[] = ['ffconcat version 1.0'];
  try {
    for (const [index, frame] of frames.entries()) {
      const name = `frame-${index}.jpg`;
      const next = frames[index + 1];
      files.push(name);
      await store.put(name, Buffer.from(frame.jpeg, 'base64'), 'image/jpeg');
      timeline.push(
        `file ${name}`,
        'option framerate 60',
        `duration ${next ? Math.max(0, next.timestamp - frame.timestamp) : 1}`
      );
    }
    timeline.push(`file ${files.at(-1)}`, 'option framerate 60');
    files.push('frames.ffconcat');
    await writeUtf8(store, 'frames.ffconcat', timeline.join('\n') + '\n');
    await writeUtf8(
      store,
      'measurement.json',
      JSON.stringify({ profile, ...result }, null, 2)
    );
    if (!ffmpeg) throw new Error('The hosted video encoder is unavailable');
    run(
      ffmpeg,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        'frames.ffconcat',
        '-vf',
        'fps=60,pad=ceil(iw/2)*2:ceil(ih/2)*2',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        `${profile}-boot.mp4`,
      ],
      { cwd: directory, timeoutMs: 30_000 }
    );
  } finally {
    await store.deleteMany(files);
  }
}

/** Record only the opt-in journey against the disposable production build. */
export async function recordOpening(
  device: Device,
  profile: Profile,
  measure: () => Promise<Result>
): Promise<Result> {
  if (
    process.env['SPEC_WORLD'] !== 'release' ||
    process.env['JOURNEY_CAPTURE_STEPS'] !== '1'
  )
    return measure();
  const before = await screenshot(device);
  await device.screencast.start();
  let result: Result;
  let frames: readonly ScreencastFrame[];
  try {
    result = await measure();
  } finally {
    frames = await device.screencast.stop();
  }
  const origin: unknown = await device.view.evaluate(
    'performance.timeOrigin / 1000'
  );
  if (typeof origin !== 'number' || !Number.isFinite(origin))
    throw new Error('Missing browser navigation time origin');
  const final = await screenshot(device);
  const end: unknown = await device.view.evaluate(
    '(performance.timeOrigin + performance.now()) / 1000'
  );
  if (typeof end !== 'number' || !Number.isFinite(end))
    throw new Error('Missing browser recording end time');
  const presented = frames.filter(
    (frame) => frame.timestamp >= origin && frame.timestamp <= end
  );
  if (!presented.length)
    throw new Error('Chrome captured no frame after navigation');
  await saveVideo(
    profile,
    [
      { timestamp: origin, jpeg: before },
      ...presented,
      { timestamp: end, jpeg: final },
    ],
    result
  );
  return result;
}
