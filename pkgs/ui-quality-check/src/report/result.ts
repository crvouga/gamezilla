import type { DetectorInfo } from '../detectors/types';
import type { FrameQuality, QualityResult } from '../types';
import type { ResolvedOptions } from '../check/config';

export function timestamp(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}

function aggregate(frames: readonly { timestampMs: number; quality: number }[], config: ResolvedOptions): number {
  const minimum = Math.min(...frames.map((f) => f.quality));
  if (config.aggregation === 'minimum' || frames.length < 2) return minimum;
  let score = 1; let pairs = 0;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1]; const b = frames[i];
    if (!a || !b || b.timestampMs - a.timestampMs > config.confirmationWindowMs) continue;
    score = Math.min(score, Math.max(a.quality, b.quality)); pairs++;
  }
  return pairs ? score : minimum;
}

export interface ResultStats { candidateFrames: number; framesAnalyzed: number; framesSkippedEmpty: number; framesSkippedIgnored: number; framesDeduplicated: number; durationMs: number }

export function buildResult(args: { input: string; kind: 'image' | 'video'; frames: readonly FrameQuality[]; config: ResolvedOptions; detectors: readonly DetectorInfo[]; stats: ResultStats; cacheKey?: string }): QualityResult {
  const { input, kind, frames, config, stats } = args;
  if (!frames.length) throw new Error(`No usable UI frames remain in ${input}. Blank or excluded recordings cannot establish visual quality.`);
  const detectors = args.detectors.map((info) => {
    const values = frames.map((f) => ({ timestampMs: f.timestampMs, quality: f.detectorScores.find((s) => s.detector === info.id)?.quality ?? 1 }));
    const score = aggregate(values, config);
    return { ...info, pass: score >= config.threshold, score };
  });
  const emptyScore = Math.min(...frames.filter((f) => f.detectorScores.some((s) => s.detector === 'empty-ui')).map((f) => f.quality), 1);
  const score = Math.min(...detectors.map((d) => d.score), emptyScore);
  const worstScore = Math.min(...frames.map((f) => f.quality));
  const sorted = [...frames].sort((a, b) => a.quality - b.quality || a.timestampMs - b.timestampMs);
  const worstFrames = sorted.filter((f) => !f.reused).slice(0, config.maxWorstFrames);
  const failures = sorted.filter((f) => f.quality < config.threshold);
  const pass = score >= config.threshold;
  const summary = pass ? `${input}: UI quality passed (${score.toFixed(3)} >= ${config.threshold}).` : `${input}: UI quality failed at ${timestamp(worstFrames[0]?.timestampMs ?? 0)}; observed ${worstScore.toFixed(3)}, required >= ${config.threshold} (${config.aggregation}).`;
  return {
    schemaVersion: 1, packageVersion: '0.1.0', kind, input, pass, score, worstScore,
    threshold: config.threshold, thresholdSource: config.thresholdSource, summary,
    ...stats, frames, worstFrames, failures, detectors,
    ...(args.cacheKey ? { cacheKey: args.cacheKey } : {}),
  };
}
