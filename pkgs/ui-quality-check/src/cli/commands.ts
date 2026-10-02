// @io-wall-ok — CLI composition root.
import type { Arguments } from './arguments';
import { createUIQualityChecker, setup } from '../api';
import { calibrate } from '../calibration/calibrate';
import { benchmark } from '../benchmark';
import { localFiles } from '../wall-io';
import { readJson, writeJson } from '../files';
import { discoverInputs, inputKind } from '../check/discover';
import { expandGlobs } from './glob';
import { textReport } from '../report/text';
import type { CheckerOptions } from '../types';
import type { DetectorInfo } from '../detectors/types';

async function configuration(args: Arguments) {
  if (!args.config) return { options: args.options, detectors: undefined };
  const stored = await readJson<{ threshold: number; aggregation?: 'minimum' | 'confirmed'; detectors?: DetectorInfo[]; samplingFps?: number; dedupeThreshold?: number }>(localFiles, args.config);
  if (typeof stored.threshold !== 'number') throw new Error('Configuration requires a numeric threshold.');
  const options: CheckerOptions = { threshold: stored.threshold, ...(stored.aggregation ? { aggregation: stored.aggregation } : {}), ...(stored.samplingFps !== undefined ? { samplingFps: stored.samplingFps } : {}), ...(stored.dedupeThreshold !== undefined ? { dedupeThreshold: stored.dedupeThreshold } : {}), ...args.options };
  return { options, detectors: stored.detectors };
}

export async function executeCommand(args: Arguments): Promise<{ value: unknown; text: string; exitCode: number }> {
  const config = await configuration(args);
  if (args.command === 'setup') {
    const result = await setup({ ...(config.options.modelDir ? { modelDir: config.options.modelDir } : {}), ...(args.sourcePath ? { sourcePath: args.sourcePath } : {}) });
    return { value: result, text: `${result.installed ? 'Installed' : 'Verified'} ${result.model} ${result.modelVersion}\n${result.modelDir}\nOffline checks are ready.`, exitCode: 0 };
  }
  if (args.command === 'calibrate') {
    if (!args.good || !args.bad) throw new Error('Calibration requires --good DIR and --bad DIR.');
    const good = (await discoverInputs(localFiles, [args.good])).filter((p) => inputKind(p) === 'image');
    const bad = (await discoverInputs(localFiles, [args.bad])).filter((p) => inputKind(p) === 'image');
    const result = await calibrate({ good, bad, options: config.options, ...(args.maxFalsePositiveRate !== undefined ? { maxFalsePositiveRate: args.maxFalsePositiveRate } : {}) });
    if (args.output && result.configuration) await writeJson(localFiles, args.output, result.configuration);
    return { value: result, text: `Known-good: ${good.length}; known-bad: ${bad.length}\nGood distribution: ${JSON.stringify(result.good)}\nBad distribution: ${JSON.stringify(result.bad)}\nRecommendation: ${JSON.stringify(result.recommended)}${result.configuration ? '' : '\nNo useful threshold meets the false-positive budget.'}`, exitCode: result.configuration ? 0 : 2 };
  }
  const inputs = await expandGlobs(localFiles, args.inputs);
  if (args.command === 'benchmark') {
    const result = await benchmark(inputs, config.options);
    return { value: result, text: JSON.stringify(result, null, 2), exitCode: 0 };
  }
  const paths = await discoverInputs(localFiles, inputs);
  if (args.command === 'image' && paths.some((p) => inputKind(p) !== 'image')) throw new Error('The image command accepts screenshots only. Use check for mixed inputs.');
  if (args.command === 'video' && paths.some((p) => inputKind(p) !== 'video')) throw new Error('The video command accepts .webm/.mp4 only. Use check for mixed inputs.');
  const checker = await createUIQualityChecker(config.options);
  try {
    if (config.detectors && JSON.stringify(config.detectors) !== JSON.stringify(checker.detectors)) throw new Error('Calibration detector version/provider does not match this checker. Recalibrate on this backend or select the calibrated provider.');
    const result = args.command === 'image' ? await checker.checkImages(paths) : args.command === 'video' ? await checker.checkVideos(paths) : await checker.check(paths);
    return { value: result, text: textReport(result), exitCode: result.pass ? 0 : 1 };
  } finally { await checker.dispose(); }
}
