import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type {
  DetectorInfo,
  QualityDetector,
  QualityScore,
  RgbImage,
} from '@pkgs/ui-quality-check-shared-ts/detectors-types';
import { executionProviderCandidates } from '@pkgs/ui-quality-check-shared-ts/providers';
import type { CheckerOptions } from '@pkgs/ui-quality-check-shared-ts/ui-quality-check-types';
import type * as Runtime from 'onnxruntime-node';
import manifest from '../assets/manifest.json';
import prompts from '../assets/prompts.json';
import type { Files } from './files';
import { verifyModel } from './setup';
import { WindowScorer } from './window-scorer';

function quality(embedding: Float64Array): number {
  const norm = Math.sqrt(
    embedding.reduce((sum, value) => sum + value * value, 0)
  );
  if (!Number.isFinite(norm) || norm === 0)
    throw new Error('Model returned an invalid image embedding.');
  const logits = prompts.embeddings.map(
    (text) =>
      embedding.reduce(
        (sum, value, i) => sum + (value / norm) * (text[i] ?? 0),
        0
      ) * 100
  );
  const score = 1 / (1 + Math.exp((logits[1] ?? 0) - (logits[0] ?? 0)));
  return Math.round(score * 1_000_000) / 1_000_000;
}

export class UIClipDetector implements QualityDetector {
  private session: Runtime.InferenceSession | undefined;
  private runtime: typeof Runtime | undefined;
  private windows: WindowScorer | undefined;
  private selected = 'uninitialized';
  private inferenceMs = 0;
  private windowsProcessed = 0;
  readonly info: DetectorInfo;

  constructor(
    private readonly files: Files,
    private readonly modelDir: string,
    private readonly options: CheckerOptions,
    private readonly clock: Clock
  ) {
    const self = this;
    this.info = {
      id: manifest.model,
      version: manifest.modelVersion,
      get executionProvider() {
        return self.selected;
      },
    };
  }

  async initialize(): Promise<void> {
    if (this.session) return;
    await verifyModel(this.files, this.modelDir, this.options.signal);
    const ort = await import('onnxruntime-node');
    this.runtime = ort;
    const errors: string[] = [];
    for (const provider of executionProviderCandidates(
      ort.listSupportedBackends(),
      this.options.provider
    )) {
      let candidate: Runtime.InferenceSession | undefined;
      try {
        candidate = await ort.InferenceSession.create(
          join(this.modelDir, 'vision.onnx'),
          {
            executionProviders: [provider],
            intraOpNumThreads: Math.min(8, availableParallelism()),
            interOpNumThreads: 1,
            graphOptimizationLevel: 'all',
            executionMode: 'sequential',
            logSeverityLevel: 3,
          }
        );
        // Availability is insufficient: run a batched smoke check before selecting an EP.
        await candidate.run({
          pixel_values: new ort.Tensor(
            'float32',
            new Float32Array(2 * 3 * 224 * 224),
            [2, 3, 224, 224]
          ),
        });
        this.options.signal?.throwIfAborted();
        this.session = candidate;
        this.selected = provider;
        this.windows = new WindowScorer(
          (tensors) => this.infer(tensors),
          this.options.batchSize ?? (provider === 'cpu' ? 16 : 32)
        );
        return;
      } catch (error) {
        if (candidate) await candidate.release();
        this.options.signal?.throwIfAborted();
        errors.push(
          `${provider}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    throw new Error(
      `No local inference provider could initialize. ${errors.join('; ')}`
    );
  }

  async score(
    images: readonly RgbImage[],
    signal?: AbortSignal
  ): Promise<readonly QualityScore[]> {
    if (!this.windows) throw new Error('Detector is not initialized.');
    const sums = await this.windows.score(images, signal);
    return sums.map((sum) => ({ quality: quality(sum) }));
  }

  private async infer(windows: readonly Float32Array[]): Promise<Float32Array> {
    const ort = this.runtime;
    if (!ort) throw new Error('Detector runtime is not initialized.');
    const data = new Float32Array(windows.length * 3 * 224 * 224);
    windows.forEach((window, i) => data.set(window, i * 3 * 224 * 224));
    const start = this.clock.now();
    const result = await this.session?.run({
      pixel_values: new ort.Tensor('float32', data, [
        windows.length,
        3,
        224,
        224,
      ]),
    });
    this.inferenceMs += this.clock.now() - start;
    this.windowsProcessed += windows.length;
    const embeddings = result?.['image_embeds']?.data;
    if (
      !(embeddings instanceof Float32Array) ||
      embeddings.length !== windows.length * 512
    )
      throw new Error('Model returned an unexpected image embedding shape.');
    return embeddings;
  }

  async dispose(): Promise<void> {
    const session = this.session;
    this.session = undefined;
    this.windows?.clear();
    this.windows = undefined;
    if (session) await session.release();
  }
  metrics() {
    return {
      inferenceMs: this.inferenceMs,
      windowsProcessed: this.windowsProcessed,
    };
  }
}
