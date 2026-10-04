import { createHash } from 'node:crypto';
import type { RgbImage } from '@pkgs/ui-quality-check-shared/detectors-types';
import { imageWindows } from './preprocess';

export type WindowInference = (
  tensors: readonly Float32Array[]
) => Promise<Float32Array>;

type WindowJob = {
  tensor: Float32Array;
  targets: { windows: Float32Array[]; index: number }[];
};

/** Cache exact preprocessed windows; 8192 embeddings occupy at most 16 MiB. */
export class WindowScorer {
  private readonly cache = new Map<string, Float32Array>();
  constructor(
    private readonly infer: WindowInference,
    private readonly batchSize: number,
    private readonly capacity = 8192
  ) {
    if (!Number.isInteger(batchSize) || batchSize < 1)
      throw new Error('Window batch size must be a positive integer.');
    if (!Number.isInteger(capacity) || capacity < 0)
      throw new Error('Window cache capacity must be a nonnegative integer.');
  }

  async score(
    images: readonly RgbImage[],
    signal?: AbortSignal
  ): Promise<readonly Float64Array[]> {
    const results: Float32Array[][] = [];
    const pending = new Map<string, WindowJob>();
    for (const image of images) {
      signal?.throwIfAborted();
      const windows: Float32Array[] = [];
      results.push(windows);
      for (const [index, tensor] of (await imageWindows(image)).entries()) {
        const key = createHash('sha256')
          .update(
            Buffer.from(tensor.buffer, tensor.byteOffset, tensor.byteLength)
          )
          .digest('hex');
        const cached = this.cache.get(key);
        if (cached) {
          this.cache.delete(key);
          this.cache.set(key, cached);
          windows[index] = cached;
          continue;
        }
        const job = pending.get(key) ?? { tensor, targets: [] };
        job.targets.push({ windows, index });
        pending.set(key, job);
        if (pending.size >= this.batchSize) await this.flush(pending, signal);
      }
    }
    if (pending.size) await this.flush(pending, signal);
    signal?.throwIfAborted();
    return results.map(sumWindows);
  }

  private async flush(
    pending: Map<string, WindowJob>,
    signal?: AbortSignal
  ): Promise<void> {
    signal?.throwIfAborted();
    const values = await this.infer([...pending.values()].map((j) => j.tensor));
    if (
      !(values instanceof Float32Array) ||
      values.length !== pending.size * 512
    )
      throw new Error('Model returned an unexpected image embedding shape.');
    signal?.throwIfAborted();
    let index = 0;
    for (const [key, job] of pending) {
      const embedding = values.slice(index * 512, ++index * 512);
      this.cache.set(key, embedding);
      while (this.cache.size > this.capacity)
        this.cache.delete(this.cache.keys().next().value!);
      for (const target of job.targets)
        target.windows[target.index] = embedding;
    }
    pending.clear();
  }

  clear(): void {
    this.cache.clear();
  }
}

function sumWindows(windows: readonly Float32Array[]): Float64Array {
  const sum = new Float64Array(512);
  for (const window of windows)
    for (let d = 0; d < 512; d++) sum[d]! += window[d]!;
  return sum;
}
