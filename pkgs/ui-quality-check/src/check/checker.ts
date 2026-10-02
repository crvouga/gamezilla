import { resolve } from 'node:path';
import type { ImageInput, RgbImage } from '../detectors/types';
import type { Files } from '../files';
import { hashBytes } from '../files';
import type { BatchQualityResult, CheckerOptions, QualityResult, UIQualityChecker } from '../types';
import { cachedResult, cacheResult, resultKey } from '../model/result-cache';
import { buildResult } from '../report/result';
import { emitArtifacts } from '../report/artifacts';
import { captureProcess, type ProcessStarter } from '../video/process';
import { batchResult, mapBounded } from './batch';
import { resolveOptions } from './config';
import { decodeImage } from './image';
import { discoverInputs, inputKind } from './discover';
import { analyzeVideo } from './video';
import type { Scorer } from './scorer';

export class ArtifactChecker implements UIQualityChecker {
  readonly config;
  private closing = false;
  private readonly active = new Set<Promise<unknown>>();
  private decoderVersion: Promise<string> | undefined;
  constructor(readonly options: CheckerOptions, private readonly files: Files, private readonly process: ProcessStarter, readonly scorer: Scorer) {
    this.config = resolveOptions(options);
  }
  get detectors() { return this.scorer.detectors.map((d) => ({ ...d.info })); }

  private operation<T>(run: () => Promise<T>): Promise<T> {
    if (this.closing) return Promise.reject(new Error('Checker has been disposed. Create a new checker.'));
    this.options.signal?.throwIfAborted();
    const task = run(); this.active.add(task);
    void task.finally(() => this.active.delete(task)).catch(() => undefined);
    return task;
  }

  private async key(input: string, kind: 'image' | 'video'): Promise<string | undefined> {
    if (!this.options.cacheDir) return undefined;
    if (kind === 'video' && !this.decoderVersion) {
      this.decoderVersion = captureProcess(this.process, { command: this.options.ffmpegPath ?? 'ffmpeg', args: ['-version'], ...(this.options.signal ? { signal: this.options.signal } : {}) }).then((result) => result.stdout.toString());
    }
    return resultKey({ files: this.files, input, config: this.config, detectors: this.detectors, decoderVersion: kind === 'video' ? await this.decoderVersion ?? '' : 'sharp-0.35.5', ...(this.options.signal ? { signal: this.options.signal } : {}) });
  }

  private async finalize(result: QualityResult, image?: RgbImage): Promise<QualityResult> {
    this.options.signal?.throwIfAborted();
    if (this.options.cacheDir) await cacheResult(this.files, this.options.cacheDir, result);
    if (!this.options.artifactsDir) return result;
    return emitArtifacts({ files: this.files, result, directory: this.options.artifactsDir, process: this.process, ffmpegPath: this.options.ffmpegPath ?? 'ffmpeg', clipMs: this.config.failureClipMs, ...(image ? { image } : {}), ...(this.options.signal ? { signal: this.options.signal } : {}) });
  }

  checkImage(input: ImageInput): Promise<QualityResult> {
    return this.checkImages([input]).then((batch) => {
      const result = batch.results[0]; if (!result) throw new Error('Missing image result.'); return result;
    });
  }

  checkImages(inputs: readonly ImageInput[]): Promise<BatchQualityResult> {
    return this.operation(async () => {
      if (!inputs.length) throw new Error('Provide at least one image.');
      const results: QualityResult[] = [];
      for (let offset = 0; offset < inputs.length; offset += this.config.batchSize) {
        const prepared = await mapBounded(inputs.slice(offset, offset + this.config.batchSize), this.config.concurrency, async (input) => {
          const image = await decodeImage(this.files, input, this.options.signal);
          const name = typeof input === 'string' ? resolve(input) : `image-${hashBytes(image.data).slice(0, 16)}`;
          const key = typeof input === 'string' ? await this.key(name, 'image') : undefined;
          const cached = key && this.options.cacheDir ? await cachedResult(this.files, this.options.cacheDir, key) : null;
          return { image, name, key, cached };
        });
        const missing = prepared.filter((p) => !p.cached);
        const scored = missing.length ? await this.scorer.score(missing.map((p) => p.image)) : [];
        let index = 0;
        for (const item of prepared) {
          const value = item.cached ? undefined : scored[index++];
          const result = item.cached ? { ...item.cached, input: item.name, summary: item.cached.summary.replace(item.cached.input, item.name) } : buildResult({
            input: item.name, kind: 'image', frames: [{ timestampMs: 0, quality: value?.quality ?? 0, detectorScores: value?.detectorScores ?? [] }], config: this.config, detectors: this.detectors,
            stats: { candidateFrames: 1, framesAnalyzed: 1, framesSkippedEmpty: 0, framesSkippedIgnored: 0, framesDeduplicated: 0, durationMs: 0 }, ...(item.key ? { cacheKey: item.key } : {}),
          });
          results.push(await this.finalize(result, item.image));
        }
      }
      return batchResult(results);
    });
  }

  private async video(input: string): Promise<QualityResult> {
    if (inputKind(input) !== 'video') throw new Error(`Expected a .webm or .mp4 video: ${input}`);
    const path = resolve(input);
    const key = await this.key(path, 'video');
    const cached = key && this.options.cacheDir ? await cachedResult(this.files, this.options.cacheDir, key) : null;
    if (cached) return this.finalize({ ...cached, input: path, summary: cached.summary.replace(cached.input, path) });
    const analyzed = await analyzeVideo({ input: path, config: this.config, scorer: this.scorer, process: this.process, ffmpegPath: this.options.ffmpegPath ?? 'ffmpeg', ...(this.options.signal ? { signal: this.options.signal } : {}) });
    return this.finalize(buildResult({ input: path, kind: 'video', ...analyzed, config: this.config, detectors: this.detectors, ...(key ? { cacheKey: key } : {}) }));
  }

  checkVideo(input: string): Promise<QualityResult> { return this.operation(() => this.video(input)); }
  checkVideos(inputs: readonly string[]): Promise<BatchQualityResult> {
    return this.operation(async () => {
      if (!inputs.length) throw new Error('Provide at least one video.');
      return batchResult(await mapBounded(inputs, this.config.concurrency, (input) => this.video(input)));
    });
  }
  check(inputs: readonly string[]): Promise<BatchQualityResult> {
    return this.operation(async () => {
      const paths = await discoverInputs(this.files, inputs);
      return batchResult(await mapBounded(paths, this.config.concurrency, async (path) => inputKind(path) === 'video' ? this.video(path) : this.checkImage(path)));
    });
  }

  async dispose(): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    await Promise.allSettled([...this.active]);
    await this.scorer.drained();
    await Promise.all(this.scorer.detectors.map((d) => d.dispose()));
  }
}
