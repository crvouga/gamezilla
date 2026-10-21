import type { ResolvedOptions } from '@pkgs/ui-quality-check-shared-ts/config';
import type { RgbImage } from '@pkgs/ui-quality-check-shared-ts/detectors-types';
import type { Scorer } from '@pkgs/ui-quality-check-shared-ts/scorer';
import { FrameSelection } from '@pkgs/ui-quality-check-shared-ts/select';
import type { VideoDecoder } from '@pkgs/ui-quality-check-shared-ts/video-types';
import { decodeVideo, probeVideo } from './decode';
import type { ProcessStarter } from './process';

interface AnalyzeOptions {
  input: string;
  config: ResolvedOptions;
  scorer: Scorer;
  process: ProcessStarter;
  ffmpegPath: string;
  signal?: AbortSignal;
  decoder?: VideoDecoder;
}

/** Only a batch of RGB frames and score metadata are retained. */
export async function analyzeVideo(args: AnalyzeOptions) {
  const options = {
    ffmpegPath: args.ffmpegPath,
    samplingFps: args.config.samplingFps,
    ...(args.signal ? { signal: args.signal } : {}),
  };
  const video = args.decoder
    ? await args.decoder.open(args.input, options)
    : await openFfmpeg(args, options);
  if (!Number.isFinite(video.durationMs) || video.durationMs < 0)
    throw new Error('Decoder returned an invalid video duration.');
  const selection = new FrameSelection(args.config, video.durationMs);
  const batch: { image: RgbImage; index: number }[] = [];
  const flush = async () => {
    if (!batch.length) return;
    const items = batch.splice(0);
    const scored = await args.scorer.score(items.map((item) => item.image));
    items.forEach((item, i) => {
      const value = scored[i];
      if (value) selection.values[item.index] = value;
    });
  };
  for await (const image of video.frames) {
    args.signal?.throwIfAborted();
    const index = selection.accept(image);
    if (index === null) continue;
    batch.push({ image, index });
    if (batch.length >= args.config.batchSize) await flush();
  }
  await flush();
  return selection.finish();
}

async function openFfmpeg(
  args: { process: ProcessStarter; input: string },
  options: { ffmpegPath: string; samplingFps: number; signal?: AbortSignal }
) {
  const metadata = await probeVideo(args.process, args.input, options);
  return {
    durationMs: metadata.durationMs,
    frames: decodeVideo(args.process, args.input, metadata, options),
  };
}
