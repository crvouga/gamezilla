import { basename, extname, join } from 'node:path';
import sharp from 'sharp';
import type { Files } from '../files';
import { hashBytes, writeBytes, writeJson } from '../files';
import type { QualityResult } from '../types';
import type { RgbImage } from '../detectors/types';
import { captureProcess, type ProcessStarter } from '../video/process';

export async function emitArtifacts(args: { files: Files; result: QualityResult; directory: string; process: ProcessStarter; ffmpegPath: string; clipMs: number; image?: RgbImage; signal?: AbortSignal }): Promise<QualityResult> {
  const { result, files } = args;
  const name = basename(result.input, extname(result.input)).replace(/[^a-zA-Z0-9_-]/g, '-');
  const directory = join(args.directory, `${name}-${hashBytes(result.input).slice(0, 12)}`);
  const worstFrames = [];
  for (const frame of result.worstFrames) {
    args.signal?.throwIfAborted();
    const artifact = join(directory, `worst-${(frame.timestampMs / 1000).toFixed(3)}.png`);
    let bytes: Uint8Array;
    if (args.image) bytes = await sharp(args.image.data, { raw: { width: args.image.width, height: args.image.height, channels: 3 } }).png().toBuffer();
    else bytes = (await captureProcess(args.process, {
      command: args.ffmpegPath,
      args: ['-hide_banner', '-loglevel', 'error', '-nostdin', '-threads', '1', '-ss', (frame.timestampMs / 1000).toFixed(3), '-i', result.input, '-map', '0:v:0', '-frames:v', '1', '-an', '-c:v', 'png', '-threads', '1', '-f', 'image2pipe', 'pipe:1'],
      ...(args.signal ? { signal: args.signal } : {}),
    })).stdout;
    if (!bytes.length) throw new Error(`Could not extract failure frame at ${frame.timestampMs}ms from ${result.input}.`);
    await writeBytes(files, artifact, bytes, 'image/png');
    let clip: string | undefined;
    if (args.clipMs > 0 && result.kind === 'video') {
      clip = join(directory, `context-${(frame.timestampMs / 1000).toFixed(3)}.mp4`);
      const startMs = Math.max(0, frame.timestampMs - args.clipMs / 2);
      const decoded = await captureProcess(args.process, {
        command: args.ffmpegPath,
        args: ['-hide_banner', '-loglevel', 'error', '-nostdin', '-threads', '1', '-ss', (startMs / 1000).toFixed(3), '-i', result.input, '-t', (args.clipMs / 1000).toFixed(3), '-map', '0:v:0', '-an', '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4', 'pipe:1'],
        ...(args.signal ? { signal: args.signal } : {}),
      });
      await writeBytes(files, clip, decoded.stdout, 'video/mp4');
    }
    worstFrames.push({ ...frame, artifact, ...(clip ? { clip } : {}) });
  }
  const updated = { ...result, worstFrames, failures: result.failures.map((frame) => worstFrames.find((worst) => worst.timestampMs === frame.timestampMs) ?? frame) };
  await writeJson(files, join(directory, 'result.json'), updated);
  return updated;
}
