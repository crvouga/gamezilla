// @io-wall-ok — CLI composition root.

import type { Arguments } from '@pkgs/ui-quality-check-shared/arguments';
import { textReport } from '@pkgs/ui-quality-check-shared/text';
import type { CheckerOptions } from '@pkgs/ui-quality-check-shared/ui-quality-check-types';
import { createUIQualityChecker, setup } from './api';
import { benchmark } from './benchmark';
import { calibrate } from './calibrate';
import { discoverInputs, inputKind } from './discover';
import { readJson, writeJson } from './files';
import { expandGlobs } from './glob';
import { localFiles } from './wall-io';

async function configuration(args: Arguments) {
  if (!args.config) return args.options;
  const stored = await readJson<CheckerOptions>(localFiles, args.config);
  if (typeof stored.threshold !== 'number')
    throw new Error('Configuration requires a numeric threshold.');
  const options: CheckerOptions = {
    threshold: stored.threshold,
    ...(stored.detectorVersions
      ? { detectorVersions: stored.detectorVersions }
      : {}),
    ...(stored.provider ? { provider: stored.provider } : {}),
    ...(stored.aggregation ? { aggregation: stored.aggregation } : {}),
    ...(stored.samplingFps !== undefined
      ? { samplingFps: stored.samplingFps }
      : {}),
    ...(stored.dedupeThreshold !== undefined
      ? { dedupeThreshold: stored.dedupeThreshold }
      : {}),
    ...(stored.batchSize !== undefined ? { batchSize: stored.batchSize } : {}),
    ...(stored.confirmationWindowMs !== undefined
      ? { confirmationWindowMs: stored.confirmationWindowMs }
      : {}),
    ...(stored.ignoreEmptyFrames !== undefined
      ? { ignoreEmptyFrames: stored.ignoreEmptyFrames }
      : {}),
    ...(stored.ignoreRegions ? { ignoreRegions: stored.ignoreRegions } : {}),
    ...args.options,
  };
  return options;
}

export async function executeCommand(
  args: Arguments
): Promise<{ value: unknown; text: string; exitCode: number }> {
  const config = await configuration(args);
  if (args.command === 'setup') return setupCommand(args, config);
  if (args.command === 'calibrate') return calibrationCommand(args, config);
  const inputs = await expandGlobs(localFiles, args.inputs);
  if (args.command === 'benchmark') {
    const result = await benchmark(inputs, config);
    return {
      value: result,
      text: JSON.stringify(result, null, 2),
      exitCode: 0,
    };
  }
  const paths = await discoverInputs(localFiles, inputs);
  if (args.command === 'image' && paths.some((p) => inputKind(p) !== 'image'))
    throw new Error(
      'The image command accepts screenshots only. Use check for mixed inputs.'
    );
  if (args.command === 'video' && paths.some((p) => inputKind(p) !== 'video'))
    throw new Error(
      'The video command accepts .webm/.mp4 only. Use check for mixed inputs.'
    );
  const checker = await createUIQualityChecker(config);
  try {
    const result =
      args.command === 'image'
        ? await checker.checkImages(paths)
        : args.command === 'video'
          ? await checker.checkVideos(paths)
          : await checker.check(paths);
    return {
      value: result,
      text: textReport(result),
      exitCode: result.pass ? 0 : 1,
    };
  } finally {
    await checker.dispose();
  }
}

async function setupCommand(args: Arguments, options: CheckerOptions) {
  const result = await setup({
    ...(options.modelDir ? { modelDir: options.modelDir } : {}),
    ...(args.sourcePath ? { sourcePath: args.sourcePath } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  return {
    value: result,
    text: `${result.installed ? 'Installed' : 'Verified'} ${result.model} ${result.modelVersion}\n${result.modelDir}\nOffline checks are ready.`,
    exitCode: 0,
  };
}

async function calibrationCommand(args: Arguments, options: CheckerOptions) {
  if (!args.good || !args.bad)
    throw new Error('Calibration requires --good DIR and --bad DIR.');
  const good = (await discoverInputs(localFiles, [args.good])).filter(
    (p) => inputKind(p) === 'image'
  );
  const bad = (await discoverInputs(localFiles, [args.bad])).filter(
    (p) => inputKind(p) === 'image'
  );
  const result = await calibrate({
    good,
    bad,
    options: options,
    ...(args.maxFalsePositiveRate !== undefined
      ? { maxFalsePositiveRate: args.maxFalsePositiveRate }
      : {}),
  });
  if (args.output && result.configuration)
    await writeJson(localFiles, args.output, result.configuration);
  return {
    value: result,
    text: `Known-good: ${good.length}; known-bad: ${bad.length}\nGood distribution: ${JSON.stringify(result.good)}\nBad distribution: ${JSON.stringify(result.bad)}\nRecommendation: ${JSON.stringify(result.recommended)}${result.configuration ? '' : '\nNo useful threshold meets the false-positive budget.'}`,
    exitCode: result.configuration ? 0 : 2,
  };
}
