import type { ResolvedOptions } from '../check/config';
import type { DetectorInfo } from '../detectors/types';
import type { FrameQuality, QualityResult } from '../types';

export function timestamp(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}

function aggregate(
  frames: readonly { timestampMs: number; quality: number }[],
  config: ResolvedOptions
): number {
  const minimum = frames.reduce(
    (score, frame) => Math.min(score, frame.quality),
    1
  );
  if (config.aggregation === 'minimum' || frames.length < 2) return minimum;
  let score = 1;
  let pairs = 0;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1];
    const b = frames[i];
    if (!a || !b || b.timestampMs - a.timestampMs > config.confirmationWindowMs)
      continue;
    score = Math.min(score, Math.max(a.quality, b.quality));
    pairs++;
  }
  return pairs ? score : minimum;
}

export interface ResultStats {
  candidateFrames: number;
  framesAnalyzed: number;
  framesSkippedEmpty: number;
  framesSkippedIgnored: number;
  framesDeduplicated: number;
  durationMs: number;
}

function detectorResults(
  frames: readonly FrameQuality[],
  config: ResolvedOptions,
  infos: readonly DetectorInfo[]
) {
  const results = infos.map((info) => {
    const values = frames.map((frame) => ({
      timestampMs: frame.timestampMs,
      quality:
        frame.detectorScores.find((score) => score.detector === info.id)
          ?.quality ?? 1,
    }));
    const score = aggregate(values, config);
    return { ...info, pass: score >= config.threshold, score };
  });
  if (
    frames.some((frame) =>
      frame.detectorScores.some((score) => score.detector === 'empty-ui')
    )
  )
    results.push({
      id: 'empty-ui',
      version: '1',
      executionProvider: 'deterministic',
      pass: config.threshold === 0,
      score: 0,
    });
  return results;
}

export function buildResult(args: {
  input: string;
  kind: 'image' | 'video';
  frames: readonly FrameQuality[];
  config: ResolvedOptions;
  detectors: readonly DetectorInfo[];
  stats: ResultStats;
  cacheKey?: string;
}): QualityResult {
  const { input, kind, frames, config, stats } = args;
  if (!frames.length)
    throw new Error(
      `No usable UI frames remain in ${input}. Blank or excluded recordings cannot establish visual quality.`
    );
  const detectors = detectorResults(frames, config, args.detectors);
  const score = detectors.reduce(
    (value, detector) => Math.min(value, detector.score),
    1
  );
  const worstScore = frames.reduce(
    (value, frame) => Math.min(value, frame.quality),
    1
  );
  const pass = score >= config.threshold;
  const sorted = [...frames].sort(
    (a, b) => a.quality - b.quality || a.timestampMs - b.timestampMs
  );
  const worstFrames = sorted
    .filter((f) => !f.reused && (pass || f.quality < config.threshold))
    .slice(0, config.maxWorstFrames);
  const failures = pass
    ? []
    : sorted.filter((f) => f.quality < config.threshold);
  const summary = pass
    ? `${input}: UI quality passed (${score.toFixed(3)} >= ${config.threshold}).`
    : `${input}: UI quality failed at ${timestamp(worstFrames[0]?.timestampMs ?? 0)}; observed ${worstScore.toFixed(3)}, required >= ${config.threshold} (${config.aggregation}).`;
  return {
    schemaVersion: 1,
    packageVersion: '0.1.0',
    kind,
    input,
    pass,
    score,
    worstScore,
    threshold: config.threshold,
    thresholdSource: config.thresholdSource,
    summary,
    ...stats,
    frames,
    worstFrames,
    failures,
    detectors,
    ...(args.cacheKey ? { cacheKey: args.cacheKey } : {}),
  };
}
