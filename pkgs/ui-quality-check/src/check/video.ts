import type { FrameQuality } from '../types';
import type { RgbImage } from '../detectors/types';
import { decodeVideo, probeVideo } from '../video/decode';
import { fingerprint, isEmpty, similar } from '../video/similarity';
import type { ProcessStarter } from '../video/process';
import type { ResolvedOptions } from './config';
import type { Scorer } from './scorer';
import type { ResultStats } from '../report/result';

interface Reference { timestampMs: number; index: number; reused: boolean }

/** Keeps only a batch of RGB frames, one thumbnail, and score metadata in memory. */
export async function analyzeVideo(args: { input: string; config: ResolvedOptions; scorer: Scorer; process: ProcessStarter; ffmpegPath: string; signal?: AbortSignal }) {
  const { input, config, scorer } = args;
  const options = { ffmpegPath: args.ffmpegPath, samplingFps: config.samplingFps, ...(args.signal ? { signal: args.signal } : {}) };
  const metadata = await probeVideo(args.process, input, options);
  const stats: ResultStats = { candidateFrames: 0, framesAnalyzed: 0, framesSkippedEmpty: 0, framesSkippedIgnored: 0, framesDeduplicated: 0, durationMs: metadata.durationMs };
  const values: Omit<FrameQuality, 'timestampMs'>[] = [];
  const references: Reference[] = [];
  const batch: { image: RgbImage; index: number }[] = [];
  let anchor: Uint8Array | undefined; let lastIndex = -1; let nextIndex = 0;
  let hasUi = false; const pendingEmpty: number[] = [];
  const flush = async () => {
    if (!batch.length) return;
    const items = batch.splice(0);
    const scored = await scorer.score(items.map((item) => item.image));
    items.forEach((item, i) => { const value = scored[i]; if (value) values[item.index] = value; });
  };
  for await (const image of decodeVideo(args.process, input, metadata, options)) {
    stats.candidateFrames++;
    stats.durationMs = Math.max(stats.durationMs, image.timestampMs);
    if (config.ignoreRegions.some((r) => image.timestampMs >= r.startMs && image.timestampMs < r.endMs)) { stats.framesSkippedIgnored++; anchor = undefined; continue; }
    if (config.ignoreEmptyFrames && isEmpty(image)) {
      if (!hasUi) stats.framesSkippedEmpty++;
      else pendingEmpty.push(image.timestampMs);
      continue;
    }
    if (pendingEmpty.length) {
      const index = nextIndex++;
      values[index] = { quality: 0, detectorScores: [{ detector: 'empty-ui', quality: 0, evidence: 'A blank black/white frame appeared between rendered UI states.' }] };
      pendingEmpty.forEach((timestampMs, i) => references.push({ timestampMs, index, reused: i !== 0 }));
      stats.framesAnalyzed++; stats.framesDeduplicated += pendingEmpty.length - 1;
      pendingEmpty.length = 0; anchor = undefined;
    }
    hasUi = true;
    const thumb = fingerprint(image);
    if (anchor && similar(anchor, thumb, config.dedupeThreshold)) {
      references.push({ timestampMs: image.timestampMs, index: lastIndex, reused: true }); stats.framesDeduplicated++; continue;
    }
    anchor = thumb; lastIndex = nextIndex++;
    batch.push({ image, index: lastIndex });
    references.push({ timestampMs: image.timestampMs, index: lastIndex, reused: false }); stats.framesAnalyzed++;
    if (batch.length >= config.batchSize) await flush();
  }
  stats.framesSkippedEmpty += pendingEmpty.length;
  await flush();
  const frames: FrameQuality[] = references.map((r) => {
    const value = values[r.index];
    if (!value) throw new Error('An analyzed frame is missing its detector scores.');
    return { timestampMs: r.timestampMs, ...value, ...(r.reused ? { reused: true as const } : {}) };
  });
  return { frames, stats };
}
