import type { CheckerOptions } from './ui-quality-check-types';

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
    thresholdSource:
      options.threshold === undefined
        ? ('experimental' as const)
        : ('explicit' as const),
  };
  validateNumbers(config);
  validateRegions(config.ignoreRegions);
  if (!['minimum', 'confirmed'].includes(config.aggregation))
    throw new Error('Aggregation must be minimum or confirmed.');
  if (typeof config.ignoreEmptyFrames !== 'boolean')
    throw new Error('ignoreEmptyFrames must be a boolean.');
  if (
    options.provider &&
    !['auto', 'cpu', 'webgpu', 'coreml', 'cuda', 'dml'].includes(
      options.provider
    )
  )
    throw new Error('Invalid local execution provider.');
  return config;
}

export type ResolvedOptions = ReturnType<typeof resolveOptions>;

function range(value: number, name: string, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(`${name} must be between ${min} and ${max}.`);
}
function validateNumbers(config: ResolvedOptions): void {
  range(config.threshold, 'threshold', 0, 1);
  range(config.dedupeThreshold, 'dedupeThreshold', 0, 1);
  range(config.samplingFps, 'samplingFps', Number.MIN_VALUE, 60);
  for (const key of ['batchSize', 'concurrency', 'maxWorstFrames'] as const) {
    range(config[key], key, 1, 128);
    if (!Number.isInteger(config[key]))
      throw new Error(`${key} must be an integer.`);
  }
  for (const key of ['confirmationWindowMs', 'failureClipMs'] as const)
    range(config[key], key, 0, Number.MAX_SAFE_INTEGER);
}
function validateRegions(regions: ResolvedOptions['ignoreRegions']): void {
  for (const region of regions) {
    range(region.startMs, 'startMs', 0, Number.MAX_SAFE_INTEGER);
    range(region.endMs, 'endMs', 0, Number.MAX_SAFE_INTEGER);
    if (region.endMs <= region.startMs)
      throw new Error('Ignore regions require startMs < endMs.');
  }
}
