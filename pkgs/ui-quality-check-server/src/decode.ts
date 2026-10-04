import { resolve } from 'node:path';
import type { RgbImage } from '@pkgs/ui-quality-check-shared/detectors-types';
import { captureProcess } from './process';
import type { ProcessStarter } from './process';

export interface VideoMetadata {
  width: number;
  height: number;
  durationMs: number;
}
export interface VideoFrame extends RgbImage {
  timestampMs: number;
}
export interface DecodeOptions {
  ffmpegPath: string;
  samplingFps: number;
  signal?: AbortSignal;
}

export async function probeVideo(
  start: ProcessStarter,
  input: string,
  options: DecodeOptions
): Promise<VideoMetadata> {
  const result = await captureProcess(start, {
    command: options.ffmpegPath,
    args: [
      '-hide_banner',
      '-nostdin',
      '-threads',
      '1',
      '-protocol_whitelist',
      'file,pipe',
      '-i',
      resolve(input),
      '-map',
      '0:v:0',
      '-frames:v',
      '1',
      '-an',
      '-f',
      'null',
      '-',
    ],
    ...(options.signal ? { signal: options.signal } : {}),
  });
  const output = result.stderr.split('Output #0')[1] ?? '';
  const dimensions = /Video:.*?\b(\d{2,5})x(\d{2,5})\b/.exec(output);
  const duration = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(result.stderr);
  const width = Number(dimensions?.[1]);
  const height = Number(dimensions?.[2]);
  const durationMs = duration
    ? Math.round(
        (Number(duration[1]) * 3600 +
          Number(duration[2]) * 60 +
          Number(duration[3])) *
          1000
      )
    : 0;
  if (!width || !height || width * height > 40_000_000)
    throw new Error(
      `Cannot read usable video dimensions from ${input}. The recording may be corrupt or unsupported.`
    );
  const scale = Math.min(1, 1024 / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    durationMs,
  };
}

function timestamps(
  stderr: AsyncIterable<Uint8Array>,
  onTimestamp: (value: number) => void
) {
  return (async () => {
    let pending = '';
    let tail = '';
    for await (const bytes of stderr) {
      pending += Buffer.from(bytes).toString();
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? '';
      for (const line of lines) {
        tail = `${tail}\n${line}`.slice(-4000);
        const match = /\bn:\s*\d+.*?\bpts_time:([\d.eE+-]+)/.exec(line);
        if (match) onTimestamp(Math.round(Number(match[1]) * 1000));
      }
    }
    return tail;
  })();
}

export async function* decodeVideo(
  start: ProcessStarter,
  input: string,
  metadata: VideoMetadata,
  options: DecodeOptions
): AsyncGenerator<VideoFrame> {
  options.signal?.throwIfAborted();
  const child = startDecoder(start, input, metadata, options);
  const times: number[] = [];
  let notify: (() => void) | undefined;
  let finished = false;
  const stderr = timestamps(child.stderr, (t) => {
    times.push(t);
    notify?.();
  });
  void stderr
    .finally(() => {
      finished = true;
      notify?.();
    })
    .catch(() => undefined);
  const frameSize = metadata.width * metadata.height * 3;
  let frame = new Uint8Array(frameSize);
  let offset = 0;
  let index = 0;
  try {
    for await (const bytes of child.stdout) {
      options.signal?.throwIfAborted();
      let consumed = 0;
      while (consumed < bytes.length) {
        const count = Math.min(frameSize - offset, bytes.length - consumed);
        frame.set(bytes.subarray(consumed, consumed + count), offset);
        offset += count;
        consumed += count;
        if (offset !== frameSize) continue;
        while (times[index] === undefined && !finished)
          await new Promise<void>((resolveWait) => {
            notify = resolveWait;
          });
        options.signal?.throwIfAborted();
        const timestampMs = times[index++];
        if (timestampMs === undefined || !Number.isFinite(timestampMs))
          throw new Error('Decoder did not provide a valid frame timestamp.');
        yield {
          data: frame,
          width: metadata.width,
          height: metadata.height,
          timestampMs,
        };
        frame = new Uint8Array(frameSize);
        offset = 0;
      }
    }
    const [code, diagnostics] = await Promise.all([child.completed, stderr]);
    options.signal?.throwIfAborted();
    if (code !== 0 || offset !== 0)
      throw new Error(
        `Video decode failed for ${input} (exit ${code}, partial bytes ${offset}): ${diagnostics}`
      );
  } finally {
    child.stop();
    await Promise.allSettled([child.completed, stderr]);
  }
}

function startDecoder(
  start: ProcessStarter,
  input: string,
  metadata: VideoMetadata,
  options: DecodeOptions
) {
  const filter = `select=if(isnan(prev_selected_t)\\,1\\,gt(floor(t*${options.samplingFps})\\,floor(prev_selected_t*${options.samplingFps}))),scale=${metadata.width}:${metadata.height}:flags=bicubic,format=rgb24,showinfo`;
  return start({
    command: options.ffmpegPath,
    args: [
      '-hide_banner',
      '-nostdin',
      '-threads',
      '1',
      '-protocol_whitelist',
      'file,pipe',
      '-i',
      resolve(input),
      '-map',
      '0:v:0',
      '-an',
      '-sn',
      '-vf',
      filter,
      '-fps_mode',
      'passthrough',
      '-threads',
      '1',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      'pipe:1',
    ],
    ...(options.signal ? { signal: options.signal } : {}),
  });
}
