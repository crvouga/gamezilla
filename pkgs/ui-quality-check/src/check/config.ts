import type { CheckerOptions } from '../types';

export function resolveOptions(options: CheckerOptions) {
  const config = {
    threshold: options.threshold ?? 0.5,
    batchSize: options.batchSize ?? 16,
    concurrency: options.concurrency ?? 2,
    samplingFps: options.samplingFps ?? 4,
    dedupeThreshold: options.dedupeThreshold ?? 0.004,
    aggregation: options.aggregation ?? 'minimum',
    confirmationWindowMs: options.confirmationWindowMs ?? 750,
    maxWorstFrames: options.maxWorstFrames ?? 3,
    ignoreEmptyFrames: options.ignoreEmptyFrames ?? true,
    ignoreRegions: options.ignoreRegions ?? [],
    failureClipMs: options.failureClipMs ?? 0,
    thresholdSource: options.threshold === undefined ? 'experimental' as const : 'explicit' as const,
  };
  for (const key of ['threshold', 'dedupeThreshold'] as const) {
    if (!Number.isFinite(config[key]) || config[key] < 0 || config[key] > 1) throw new Error(`${key} must be between 0 and 1.`);
  }
  for (const key of ['batchSize', 'concurrency', 'maxWorstFrames'] as const) {
    if (!Number.isInteger(config[key]) || config[key] < 1 || config[key] > 128) throw new Error(`${key} must be an integer between 1 and 128.`);
  }
  if (!Number.isFinite(config.samplingFps) || config.samplingFps <= 0 || config.samplingFps > 60) throw new Error('samplingFps must be greater than 0 and at most 60.');
  for (const key of ['confirmationWindowMs', 'failureClipMs'] as const) {
    if (!Number.isFinite(config[key]) || config[key] < 0) throw new Error(`${key} must be nonnegative.`);
  }
  for (const region of config.ignoreRegions) {
    if (!Number.isFinite(region.startMs) || !Number.isFinite(region.endMs) || region.startMs < 0 || region.endMs <= region.startMs) throw new Error('Ignore regions require 0 <= startMs < endMs.');
  }
  return config;
}

export type ResolvedOptions = ReturnType<typeof resolveOptions>;
