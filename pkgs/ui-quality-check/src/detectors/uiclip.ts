import * as ort from 'onnxruntime-node';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import type { Files } from '../files';
import type { CheckerOptions } from '../types';
import { verifyModel } from '../model/setup';
import manifest from '../../assets/manifest.json';
import prompts from '../../assets/prompts.json';
import { imageWindows } from './preprocess';
import type { DetectorInfo, QualityDetector, QualityScore, RgbImage } from './types';

function providerOrder(provider: CheckerOptions['provider']): string[] {
  if (provider && provider !== 'auto') return [provider];
  const bundled = new Set(ort.listSupportedBackends().filter((p) => p.bundled).map((p) => p.name));
  // WebGPU was substantially faster and more accurate than Core ML for this graph.
  return ['cuda', 'webgpu', 'dml', 'cpu'].filter((p) => bundled.has(p));
}

function quality(embedding: Float64Array): number {
  const norm = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm === 0) throw new Error('Model returned an invalid image embedding.');
  const logits = prompts.embeddings.map((text) => embedding.reduce((sum, value, i) => sum + value / norm * (text[i] ?? 0), 0) * 100);
  const score = 1 / (1 + Math.exp((logits[1] ?? 0) - (logits[0] ?? 0)));
  return Math.round(score * 1_000_000) / 1_000_000;
}

export class UIClipDetector implements QualityDetector {
  private session: ort.InferenceSession | undefined;
  private selected = 'uninitialized';
  readonly info: DetectorInfo;

  constructor(private readonly files: Files, private readonly modelDir: string, private readonly options: CheckerOptions) {
    const self = this;
    this.info = { id: manifest.model, version: manifest.modelVersion, get executionProvider() { return self.selected; } };
  }

  async initialize(): Promise<void> {
    if (this.session) return;
    await verifyModel(this.files, this.modelDir, this.options.signal);
    const errors: string[] = [];
    for (const provider of providerOrder(this.options.provider)) {
      let candidate: ort.InferenceSession | undefined;
      try {
        candidate = await ort.InferenceSession.create(join(this.modelDir, 'vision.onnx'), {
          executionProviders: [provider], intraOpNumThreads: Math.min(8, availableParallelism()), interOpNumThreads: 1,
          graphOptimizationLevel: 'all', executionMode: 'sequential', logSeverityLevel: 3,
        });
        // Availability is insufficient: run a batched smoke check before selecting an EP.
        await candidate.run({ pixel_values: new ort.Tensor('float32', new Float32Array(2 * 3 * 224 * 224), [2, 3, 224, 224]) });
        this.options.signal?.throwIfAborted();
        this.session = candidate; this.selected = provider; return;
      } catch (error) {
        if (candidate) await candidate.release();
        this.options.signal?.throwIfAborted();
        errors.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    throw new Error(`No local inference provider could initialize. ${errors.join('; ')}`);
  }

  async score(images: readonly RgbImage[], signal?: AbortSignal): Promise<readonly QualityScore[]> {
    if (!this.session) throw new Error('Detector is not initialized.');
    const sums = images.map(() => new Float64Array(512));
    const counts = images.map(() => 0);
    const windows: { image: number; tensor: Float32Array }[] = [];
    const limit = this.options.batchSize ?? (this.selected === 'cpu' ? 16 : 32);
    for (let i = 0; i < images.length; i++) {
      signal?.throwIfAborted();
      const image = images[i];
      if (!image) continue;
      for (const tensor of await imageWindows(image)) {
        windows.push({ image: i, tensor });
        if (windows.length >= limit) await this.infer(windows.splice(0), sums, counts);
      }
    }
    if (windows.length) await this.infer(windows, sums, counts);
    signal?.throwIfAborted();
    return sums.map((sum) => ({ quality: quality(sum) }));
  }

  private async infer(windows: readonly { image: number; tensor: Float32Array }[], sums: Float64Array[], counts: number[]): Promise<void> {
    const data = new Float32Array(windows.length * 3 * 224 * 224);
    windows.forEach((window, i) => data.set(window.tensor, i * 3 * 224 * 224));
    const result = await this.session?.run({ pixel_values: new ort.Tensor('float32', data, [windows.length, 3, 224, 224]) });
    const embeddings = result?.['image_embeds']?.data;
    if (!(embeddings instanceof Float32Array) || embeddings.length !== windows.length * 512) throw new Error('Model returned an unexpected image embedding shape.');
    windows.forEach((window, i) => {
      const sum = sums[window.image];
      if (!sum) return;
      for (let d = 0; d < 512; d++) sum[d] = (sum[d] ?? 0) + (embeddings[i * 512 + d] ?? 0);
      counts[window.image] = (counts[window.image] ?? 0) + 1;
    });
  }

  async dispose(): Promise<void> {
    const session = this.session; this.session = undefined;
    if (session) await session.release();
  }
}
