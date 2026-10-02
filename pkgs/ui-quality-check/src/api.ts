// @io-wall-ok — standalone API composition root.

import { ArtifactChecker } from './check/checker';
import { resolveOptions } from './check/config';
import { Scorer } from './check/scorer';
import type { ImageInput, QualityDetector } from './detectors/types';
import { UIClipDetector } from './detectors/uiclip';
import { UIQualityError } from './errors';
import { prepareModel, type SetupOptions } from './model/setup';
import type {
  BatchQualityResult,
  CheckerOptions,
  QualityResult,
  UIQualityChecker,
} from './types';
import {
  assetDirectory,
  decoderPath,
  defaultModelDirectory,
  localClock,
  localFiles,
  localHttp,
  localProcess,
} from './wall-io';

export async function setup(options: SetupOptions = {}) {
  return prepareModel({
    files: localFiles,
    http: localHttp,
    modelDir: options.modelDir ?? defaultModelDirectory,
    assetDir: assetDirectory,
    options,
  });
}

export async function createUIQualityChecker(
  options: CheckerOptions = {}
): Promise<UIQualityChecker> {
  const clock = options.clock ?? localClock;
  const start = clock.now();
  resolveOptions(options);
  options.signal?.throwIfAborted();
  const detectors: readonly QualityDetector[] = options.detectors ?? [
    new UIClipDetector(
      localFiles,
      options.modelDir ?? defaultModelDirectory,
      options,
      clock
    ),
  ];
  if (
    !detectors.length ||
    new Set(detectors.map((d) => d.info.id)).size !== detectors.length
  )
    throw new Error(
      'Provide at least one detector, with unique nonempty detector ids.'
    );
  if (
    detectors.some(
      (d) => !d.info.id || !d.info.version || !d.info.executionProvider
    )
  )
    throw new Error(
      'Each detector requires a nonempty id, version and executionProvider.'
    );
  try {
    for (const detector of detectors) await detector.initialize();
    options.signal?.throwIfAborted();
    if (
      options.detectorVersions &&
      JSON.stringify(options.detectorVersions) !==
        JSON.stringify(detectors.map((d) => ({ ...d.info })))
    )
      throw new Error(
        'Calibration detector version/provider does not match this checker. Recalibrate or select the calibrated provider.'
      );
    const checker = new ArtifactChecker(
      { ...options, ffmpegPath: decoderPath(options.ffmpegPath) },
      localFiles,
      localProcess,
      new Scorer(detectors, clock, options.signal)
    );
    checker.startupMs = clock.now() - start;
    return checker;
  } catch (error) {
    await Promise.allSettled(detectors.map((d) => d.dispose()));
    throw error;
  }
}

let defaultChecker: Promise<UIQualityChecker> | undefined;

async function useChecker<T>(
  options: CheckerOptions | undefined,
  run: (checker: UIQualityChecker) => Promise<T>
): Promise<T> {
  if (options) {
    const checker = await createUIQualityChecker(options);
    try {
      return await run(checker);
    } finally {
      await checker.dispose();
    }
  }
  if (defaultChecker === undefined) {
    defaultChecker = createUIQualityChecker();
    void defaultChecker.catch(() => {
      defaultChecker = undefined;
    });
  }
  return run(await defaultChecker);
}

/** Release the shared model used by configuration-free convenience calls. */
export async function disposeDefaultChecker(): Promise<void> {
  const checker = defaultChecker;
  defaultChecker = undefined;
  if (checker !== undefined) await (await checker).dispose();
}

export function checkImage(
  input: ImageInput,
  options?: CheckerOptions
): Promise<QualityResult> {
  return useChecker(options, (c) => c.checkImage(input));
}
export function checkImages(
  inputs: readonly ImageInput[],
  options?: CheckerOptions
): Promise<BatchQualityResult> {
  return useChecker(options, (c) => c.checkImages(inputs));
}
export function checkVideo(
  input: string,
  options?: CheckerOptions
): Promise<QualityResult> {
  return useChecker(options, (c) => c.checkVideo(input));
}
export function checkVideos(
  inputs: readonly string[],
  options?: CheckerOptions
): Promise<BatchQualityResult> {
  return useChecker(options, (c) => c.checkVideos(inputs));
}
export function check(
  inputs: readonly string[],
  options?: CheckerOptions
): Promise<BatchQualityResult> {
  return useChecker(options, (c) => c.check(inputs));
}

async function assertQuality(
  result: Promise<QualityResult | BatchQualityResult>
): Promise<void> {
  const resolved = await result;
  if (!resolved.pass) throw new UIQualityError(resolved);
}
export function assertImageQuality(
  input: ImageInput,
  options?: CheckerOptions
): Promise<void> {
  return assertQuality(checkImage(input, options));
}
export function assertImagesQuality(
  inputs: readonly ImageInput[],
  options?: CheckerOptions
): Promise<void> {
  return assertQuality(checkImages(inputs, options));
}
export function assertVideoQuality(
  input: string,
  options?: CheckerOptions
): Promise<void> {
  return assertQuality(checkVideo(input, options));
}
export function assertVideosQuality(
  inputs: readonly string[],
  options?: CheckerOptions
): Promise<void> {
  return assertQuality(checkVideos(inputs, options));
}
