import { resolve } from 'node:path';
import { batchResult, mapBounded } from '@pkgs/ui-quality-check-shared/batch';
import { resolveOptions } from '@pkgs/ui-quality-check-shared/config';
import type {
  ImageInput,
  RgbImage,
} from '@pkgs/ui-quality-check-shared/detectors-types';
import { WorkLimiter } from '@pkgs/ui-quality-check-shared/limiter';
import { buildResult } from '@pkgs/ui-quality-check-shared/result';
import type { Scorer } from '@pkgs/ui-quality-check-shared/scorer';
import type {
  BatchQualityResult,
  CheckerOptions,
  FrameQuality,
  QualityResult,
  UIQualityChecker,
} from '@pkgs/ui-quality-check-shared/ui-quality-check-types';
import { emitArtifacts } from './artifacts';
import { discoverInputs, inputKind } from './discover';
import type { Files } from './files';
import { hashBytes } from './files';
import { decodeImage } from './image';
import type { ProcessStarter } from './process';
import { captureProcess } from './process';
import { cachedResult, cacheResult, resultKey } from './result-cache';
import { analyzeVideo } from './video';

export class ArtifactChecker implements UIQualityChecker {
  readonly config;
  startupMs = 0;
  private closing = false;
  private disposal: Promise<void> | undefined;
  private readonly videoLimiter: WorkLimiter;
  private readonly active = new Set<Promise<unknown>>();
  private decoderVersion: Promise<string> | undefined;
  constructor(
    readonly options: CheckerOptions,
    private readonly files: Files,
    private readonly process: ProcessStarter,
    readonly scorer: Scorer
  ) {
    this.config = resolveOptions(options);
    this.videoLimiter = new WorkLimiter(this.config.concurrency);
  }
  get detectors() {
    return this.scorer.detectors.map((d) => ({ ...d.info }));
  }
  metrics() {
    const detectorMetrics = this.scorer.detectors.map((d) => d.metrics?.());
    return {
      startupMs: this.startupMs,
      scoringMs: this.scorer.scoringMs,
      batches: this.scorer.batches,
      inferenceMs: detectorMetrics.reduce(
        (n, m) => n + (m?.inferenceMs ?? 0),
        0
      ),
      windowsProcessed: detectorMetrics.reduce(
        (n, m) => n + (m?.windowsProcessed ?? 0),
        0
      ),
    };
  }

  private operation<T>(run: () => Promise<T>): Promise<T> {
    if (this.closing)
      return Promise.reject(
        new Error('Checker has been disposed. Create a new checker.')
      );
    this.options.signal?.throwIfAborted();
    const task = run();
    this.active.add(task);
    void task.finally(() => this.active.delete(task)).catch(() => undefined);
    return task;
  }

  private async key(
    input: string,
    kind: 'image' | 'video'
  ): Promise<string | undefined> {
    if (!this.options.cacheDir) return undefined;
    if (kind === 'video' && !this.decoderVersion && !this.options.decoder) {
      this.decoderVersion = captureProcess(this.process, {
        command: this.options.ffmpegPath ?? 'ffmpeg',
        args: ['-version'],
        ...(this.options.signal ? { signal: this.options.signal } : {}),
      }).then((result) => result.stdout.toString());
    }
    return resultKey({
      files: this.files,
      input,
      config: this.config,
      detectors: this.detectors,
      decoderVersion:
        kind === 'video'
          ? (this.options.decoder?.version ?? (await this.decoderVersion) ?? '')
          : 'sharp-0.35.5',
      ...(this.options.signal ? { signal: this.options.signal } : {}),
    });
  }

  private async finalize(
    result: QualityResult,
    image?: RgbImage
  ): Promise<QualityResult> {
    this.options.signal?.throwIfAborted();
    if (this.options.cacheDir)
      await cacheResult(this.files, this.options.cacheDir, result);
    if (!this.options.artifactsDir) return result;
    return emitArtifacts({
      files: this.files,
      result,
      directory: this.options.artifactsDir,
      process: this.process,
      ffmpegPath: this.options.ffmpegPath ?? 'ffmpeg',
      clipMs: this.config.failureClipMs,
      ...(image ? { image } : {}),
      ...(this.options.signal ? { signal: this.options.signal } : {}),
    });
  }

  checkImage(input: ImageInput): Promise<QualityResult> {
    return this.checkImages([input]).then((batch) => {
      const result = batch.results[0];
      if (!result) throw new Error('Missing image result.');
      return result;
    });
  }

  checkImages(inputs: readonly ImageInput[]): Promise<BatchQualityResult> {
    return this.operation(() => this.images(inputs));
  }
  private async prepareImage(input: ImageInput) {
    const image = await decodeImage(this.files, input, this.options.signal);
    const name =
      typeof input === 'string'
        ? resolve(input)
        : `image-${image.width}x${image.height}-${hashBytes(image.data).slice(0, 16)}`;
    const key =
      typeof input === 'string' ? await this.key(name, 'image') : undefined;
    const cached =
      key && this.options.cacheDir
        ? await cachedResult(this.files, this.options.cacheDir, key)
        : null;
    return { image, name, key, cached };
  }
  private imageResult(
    item: {
      name: string;
      key: string | undefined;
      cached: QualityResult | null;
    },
    value: Omit<FrameQuality, 'timestampMs'> | undefined
  ) {
    if (item.cached)
      return {
        ...item.cached,
        input: item.name,
        summary: item.cached.summary.replace(item.cached.input, item.name),
      };
    if (!value) throw new Error('Missing image detector scores.');
    return buildResult({
      input: item.name,
      kind: 'image',
      frames: [{ timestampMs: 0, ...value }],
      config: this.config,
      detectors: this.detectors,
      stats: {
        candidateFrames: 1,
        framesAnalyzed: 1,
        framesSkippedEmpty: 0,
        framesSkippedIgnored: 0,
        framesDeduplicated: 0,
        durationMs: 0,
      },
      ...(item.key ? { cacheKey: item.key } : {}),
    });
  }
  private async images(
    inputs: readonly ImageInput[]
  ): Promise<BatchQualityResult> {
    if (!inputs.length) throw new Error('Provide at least one image.');
    const results: QualityResult[] = [];
    for (
      let offset = 0;
      offset < inputs.length;
      offset += this.config.batchSize
    ) {
      const prepared = await mapBounded(
        inputs.slice(offset, offset + this.config.batchSize),
        this.config.concurrency,
        (input) => this.prepareImage(input)
      );
      const missing = prepared.filter((p) => !p.cached);
      const scored = missing.length
        ? await this.scorer.score(missing.map((p) => p.image))
        : [];
      let index = 0;
      for (const item of prepared) {
        const value = item.cached ? undefined : scored[index++];
        results.push(
          await this.finalize(this.imageResult(item, value), item.image)
        );
      }
    }
    return batchResult(results);
  }

  private video(input: string): Promise<QualityResult> {
    return this.videoLimiter.run(() => this.analyzeVideo(input));
  }
  private async analyzeVideo(input: string): Promise<QualityResult> {
    if (inputKind(input) !== 'video')
      throw new Error(`Expected a .webm or .mp4 video: ${input}`);
    const path = resolve(input);
    const key = await this.key(path, 'video');
    const cached =
      key && this.options.cacheDir
        ? await cachedResult(this.files, this.options.cacheDir, key)
        : null;
    if (cached)
      return this.finalize({
        ...cached,
        input: path,
        summary: cached.summary.replace(cached.input, path),
      });
    const analyzed = await analyzeVideo({
      input: path,
      config: this.config,
      scorer: this.scorer,
      process: this.process,
      ffmpegPath: this.options.ffmpegPath ?? 'ffmpeg',
      ...(this.options.signal ? { signal: this.options.signal } : {}),
      ...(this.options.decoder ? { decoder: this.options.decoder } : {}),
    });
    return this.finalize(
      buildResult({
        input: path,
        kind: 'video',
        ...analyzed,
        config: this.config,
        detectors: this.detectors,
        ...(key ? { cacheKey: key } : {}),
      })
    );
  }

  checkVideo(input: string): Promise<QualityResult> {
    return this.operation(() => this.video(input));
  }
  checkVideos(inputs: readonly string[]): Promise<BatchQualityResult> {
    return this.operation(async () => {
      if (!inputs.length) throw new Error('Provide at least one video.');
      return batchResult(
        await mapBounded(inputs, this.config.concurrency, (input) =>
          this.video(input)
        )
      );
    });
  }
  check(inputs: readonly string[]): Promise<BatchQualityResult> {
    return this.operation(async () => {
      const paths = await discoverInputs(this.files, inputs);
      const groups = await mapBounded(
        ['image', 'video'] as const,
        2,
        async (kind) => {
          const selected = paths.filter((path) => inputKind(path) === kind);
          if (!selected.length) return [];
          return kind === 'image'
            ? (await this.images(selected)).results
            : mapBounded(selected, this.config.concurrency, (path) =>
                this.video(path)
              );
        }
      );
      const results = new Map(
        groups.flat().map((result) => [result.input, result])
      );
      return batchResult(
        paths.map((path) => {
          const result = results.get(path);
          if (!result) throw new Error(`Missing result for ${path}.`);
          return result;
        })
      );
    });
  }

  dispose(): Promise<void> {
    if (this.disposal !== undefined) return this.disposal;
    this.closing = true;
    this.disposal = this.close();
    return this.disposal;
  }
  private async close(): Promise<void> {
    await Promise.allSettled([...this.active]);
    await this.scorer.drained();
    await Promise.all(this.scorer.detectors.map((d) => d.dispose()));
  }
}
