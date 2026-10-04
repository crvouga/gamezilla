import { basename, extname, join } from 'node:path';
import type { RgbImage } from '@pkgs/ui-quality-check-shared/detectors-types';
import type {
  FrameQualityFailure,
  QualityResult,
} from '@pkgs/ui-quality-check-shared/ui-quality-check-types';
import sharp from 'sharp';
import type { Files } from './files';
import { hashBytes, writeBytes, writeJson } from './files';
import type { ProcessStarter } from './process';
import { captureProcess } from './process';

interface ArtifactOptions {
  files: Files;
  result: QualityResult;
  directory: string;
  process: ProcessStarter;
  ffmpegPath: string;
  clipMs: number;
  image?: RgbImage;
  signal?: AbortSignal;
}

export async function emitArtifacts(
  args: ArtifactOptions
): Promise<QualityResult> {
  const { result, files } = args;
  const name = basename(result.input, extname(result.input)).replace(
    /[^a-zA-Z0-9_-]/g,
    '-'
  );
  const directory = join(
    args.directory,
    `${name}-${hashBytes(result.input).slice(0, 12)}`
  );
  const worstFrames: FrameQualityFailure[] = [];
  for (const frame of result.pass ? [] : result.worstFrames) {
    args.signal?.throwIfAborted();
    const artifact = join(
      directory,
      `worst-${(frame.timestampMs / 1000).toFixed(3)}.png`
    );
    const bytes = await pngBytes(args, frame.timestampMs);
    if (!bytes.length)
      throw new Error(
        `Could not extract failure frame at ${frame.timestampMs}ms from ${result.input}.`
      );
    await writeBytes(files, artifact, bytes, 'image/png');
    const clip = await emitClip(args, frame.timestampMs, directory);
    worstFrames.push({ ...frame, artifact, ...(clip ? { clip } : {}) });
  }
  const updated = {
    ...result,
    worstFrames,
    failures: result.failures.map(
      (frame) =>
        worstFrames.find((worst) => worst.timestampMs === frame.timestampMs) ??
        frame
    ),
  };
  await writeJson(files, join(directory, 'result.json'), updated);
  return updated;
}

async function pngBytes(
  args: ArtifactOptions,
  timestampMs: number
): Promise<Uint8Array> {
  let bytes: Uint8Array;
  if (args.image)
    bytes = await sharp(args.image.data, {
      raw: {
        width: args.image.width,
        height: args.image.height,
        channels: 3,
      },
    })
      .png()
      .toBuffer();
  else
    bytes = (
      await captureProcess(args.process, {
        command: args.ffmpegPath,
        args: [
          '-hide_banner',
          '-loglevel',
          'error',
          '-nostdin',
          '-threads',
          '1',
          '-ss',
          // Seek before the half-millisecond rounding boundary, so an upward
          // rounded source PTS cannot silently extract the following frame.
          (Math.max(0, timestampMs - 0.5) / 1000).toFixed(6),
          '-protocol_whitelist',
          'file,pipe',
          '-i',
          args.result.input,
          '-map',
          '0:v:0',
          '-frames:v',
          '1',
          '-an',
          '-c:v',
          'png',
          '-threads',
          '1',
          '-f',
          'image2pipe',
          'pipe:1',
        ],
        ...(args.signal ? { signal: args.signal } : {}),
      })
    ).stdout;
  return bytes;
}

async function emitClip(
  args: ArtifactOptions,
  timestampMs: number,
  directory: string
): Promise<string | undefined> {
  let clip: string | undefined;
  if (args.clipMs > 0 && args.result.kind === 'video') {
    clip = join(directory, `context-${(timestampMs / 1000).toFixed(3)}.mp4`);
    const startMs = Math.max(0, timestampMs - args.clipMs / 2);
    const decoded = await captureProcess(args.process, {
      command: args.ffmpegPath,
      args: [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-threads',
        '1',
        '-ss',
        (startMs / 1000).toFixed(3),
        '-protocol_whitelist',
        'file,pipe',
        '-i',
        args.result.input,
        '-t',
        (args.clipMs / 1000).toFixed(3),
        '-map',
        '0:v:0',
        '-an',
        '-c:v',
        'libx264',
        '-threads',
        '1',
        '-pix_fmt',
        'yuv420p',
        '-vf',
        'pad=ceil(iw/2)*2:ceil(ih/2)*2',
        '-movflags',
        'frag_keyframe+empty_moov',
        '-f',
        'mp4',
        'pipe:1',
      ],
      ...(args.signal ? { signal: args.signal } : {}),
    });
    await writeBytes(args.files, clip, decoded.stdout, 'video/mp4');
  }
  return clip;
}
