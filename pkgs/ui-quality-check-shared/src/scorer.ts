import type { Clock } from '@pkgs/clock-shared/types';
import type { QualityDetector, RgbImage } from './detectors-types';
import type { FrameQuality } from './ui-quality-check-types';

/** One serialized inference lane shared by all concurrently decoding videos. */
export class Scorer {
  private tail: Promise<unknown> = Promise.resolve();
  scoringMs = 0;
  batches = 0;
  constructor(
    readonly detectors: readonly QualityDetector[],
    private readonly clock: Clock,
    private readonly signal?: AbortSignal
  ) {}

  score(
    images: readonly RgbImage[]
  ): Promise<readonly Omit<FrameQuality, 'timestampMs'>[]> {
    const pending = this.tail.then(() => this.run(images));
    this.tail = pending.catch(() => undefined);
    return pending;
  }

  private async run(
    images: readonly RgbImage[]
  ): Promise<readonly Omit<FrameQuality, 'timestampMs'>[]> {
    this.signal?.throwIfAborted();
    const start = this.clock.now();
    const scores: FrameQuality['detectorScores'][] = [];
    for (const detector of this.detectors) {
      const values = await detector.score(images, this.signal);
      if (
        values.length !== images.length ||
        values.some(
          (s) => !Number.isFinite(s.quality) || s.quality < 0 || s.quality > 1
        )
      )
        throw new Error(
          `Detector ${detector.info.id} must return one finite [0,1] score per image.`
        );
      scores.push(
        values.map((s) => ({
          detector: detector.info.id,
          quality: Math.round(s.quality * 1_000_000) / 1_000_000,
          ...(s.evidence ? { evidence: s.evidence } : {}),
        }))
      );
    }
    this.signal?.throwIfAborted();
    this.scoringMs += this.clock.now() - start;
    this.batches++;
    return images.map((_, i) => {
      const detectorScores = scores
        .map((row) => row[i])
        .filter((s) => s !== undefined);
      return {
        quality: Math.min(...detectorScores.map((s) => s.quality)),
        detectorScores,
      };
    });
  }

  async drained(): Promise<void> {
    await this.tail;
  }
}
