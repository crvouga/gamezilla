// @io-wall-ok — benchmark composition root; measurements are separate from quality results.

import { createUIQualityChecker } from './api';
import { discoverInputs, inputKind } from './discover';
import type { CheckerOptions } from '@pkgs/ui-quality-check-shared/ui-quality-check-types';
import { localClock, localFiles, runtimeMetrics } from './wall-io';

export async function benchmark(
  inputs: readonly string[],
  options: CheckerOptions = {}
) {
  const paths = (await discoverInputs(localFiles, inputs)).filter(
    (p) => inputKind(p) === 'video'
  );
  if (!paths.length)
    throw new Error('Benchmark requires at least one .webm or .mp4 video.');
  const before = runtimeMetrics();
  const started = localClock.now();
  const checkerOptions = { ...options };
  delete checkerOptions.cacheDir;
  delete checkerOptions.artifactsDir;
  const checker = await createUIQualityChecker(checkerOptions);
  try {
    const scoringStarted = localClock.now();
    const result = await checker.checkVideos(paths);
    const elapsedMs = localClock.now() - started;
    const processingMs = localClock.now() - scoringStarted;
    const after = runtimeMetrics();
    const metrics = checker.metrics();
    const durationMs = result.results.reduce((n, r) => n + r.durationMs, 0);
    const framesAnalyzed = result.results.reduce(
      (n, r) => n + r.framesAnalyzed,
      0
    );
    const cpuMs =
      (after.cpu.user +
        after.cpu.system -
        before.cpu.user -
        before.cpu.system) /
      1000;
    return {
      schemaVersion: 1 as const,
      backend: checker.detectors,
      videos: paths.length,
      durationMs,
      elapsedMs,
      processingMs,
      candidateFrames: result.results.reduce(
        (n, r) => n + r.candidateFrames,
        0
      ),
      framesAnalyzed,
      framesDeduplicated: result.results.reduce(
        (n, r) => n + r.framesDeduplicated,
        0
      ),
      ...metrics,
      inferenceWindowsPerSecond: metrics.inferenceMs
        ? (metrics.windowsProcessed * 1000) / metrics.inferenceMs
        : 0,
      framesPerSecond: processingMs
        ? (framesAnalyzed * 1000) / processingMs
        : 0,
      videosPerMinute: elapsedMs ? (paths.length * 60_000) / elapsedMs : 0,
      realtimeFactor: elapsedMs ? durationMs / elapsedMs : 0,
      peakRssBytes: after.resource.maxRSS * 1024,
      rssBytes: after.memory.rss,
      parentCpuUtilizationPercent: elapsedMs ? (cpuMs / elapsedMs) * 100 : 0,
      gpuUtilizationPercent: null,
      measurementNotes:
        'CPU includes the Node/Bun process only; FFmpeg child CPU is excluded. Peak RSS covers the process lifetime. Portable Node APIs do not expose GPU utilization; use an external profiler for GPU occupancy.',
      configuration: {
        batchSize: options.batchSize ?? 16,
        samplingFps: options.samplingFps ?? 4,
        dedupeThreshold: options.dedupeThreshold ?? 0.004,
        concurrency: options.concurrency ?? 2,
      },
    };
  } finally {
    await checker.dispose();
  }
}
