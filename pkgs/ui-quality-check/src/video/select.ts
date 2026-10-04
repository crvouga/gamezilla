import type { ResolvedOptions } from '../check/config';
import type { ResultStats } from '../report/result';
import type { FrameQuality } from '../types';
import { fingerprint, isEmpty, similar } from './similarity';
import type { DecodedFrame } from './types';

export class FrameSelection {
  readonly stats: ResultStats;
  readonly values: Omit<FrameQuality, 'timestampMs'>[] = [];
  private readonly references: {
    timestampMs: number;
    index: number;
    reused: boolean;
  }[] = [];
  private anchor: Uint8Array | undefined;
  private lastIndex = -1;
  private nextIndex = 0;
  private lastTimestamp = -1;
  private hasUi = false;
  private readonly pendingEmpty: number[] = [];
  constructor(
    private readonly config: ResolvedOptions,
    durationMs: number
  ) {
    this.stats = {
      candidateFrames: 0,
      framesAnalyzed: 0,
      framesSkippedEmpty: 0,
      framesSkippedIgnored: 0,
      framesDeduplicated: 0,
      durationMs,
    };
  }
  accept(image: DecodedFrame): number | null {
    if (
      !Number.isFinite(image.timestampMs) ||
      image.timestampMs < 0 ||
      image.timestampMs <= this.lastTimestamp ||
      image.width < 1 ||
      image.height < 1 ||
      !Number.isInteger(image.width) ||
      !Number.isInteger(image.height) ||
      image.width * image.height > 40_000_000 ||
      image.data.length !== image.width * image.height * 3
    )
      throw new Error(
        'Decoder must return RGB frames with strictly increasing nonnegative timestamps.'
      );
    this.lastTimestamp = image.timestampMs;
    this.stats.candidateFrames++;
    this.stats.durationMs = Math.max(this.stats.durationMs, image.timestampMs);
    if (
      this.config.ignoreRegions.some(
        (r) => image.timestampMs >= r.startMs && image.timestampMs < r.endMs
      )
    ) {
      this.stats.framesSkippedIgnored++;
      this.anchor = undefined;
      return null;
    }
    if (this.config.ignoreEmptyFrames && isEmpty(image)) {
      if (!this.hasUi) this.stats.framesSkippedEmpty++;
      else this.pendingEmpty.push(image.timestampMs);
      return null;
    }
    this.flushInteriorEmpty();
    this.hasUi = true;
    const thumb = fingerprint(image);
    if (
      this.anchor &&
      similar(this.anchor, thumb, this.config.dedupeThreshold)
    ) {
      this.references.push({
        timestampMs: image.timestampMs,
        index: this.lastIndex,
        reused: true,
      });
      this.stats.framesDeduplicated++;
      return null;
    }
    this.anchor = thumb;
    this.lastIndex = this.nextIndex++;
    this.references.push({
      timestampMs: image.timestampMs,
      index: this.lastIndex,
      reused: false,
    });
    this.stats.framesAnalyzed++;
    return this.lastIndex;
  }
  private flushInteriorEmpty(): void {
    if (!this.pendingEmpty.length) return;
    const index = this.nextIndex++;
    this.values[index] = {
      quality: 0,
      detectorScores: [
        {
          detector: 'empty-ui',
          quality: 0,
          evidence:
            'A blank black/white frame appeared between rendered UI states.',
        },
      ],
    };
    this.pendingEmpty.forEach((timestampMs, i) =>
      this.references.push({ timestampMs, index, reused: i !== 0 })
    );
    this.stats.framesAnalyzed++;
    this.stats.framesDeduplicated += this.pendingEmpty.length - 1;
    this.pendingEmpty.length = 0;
    this.anchor = undefined;
  }
  finish() {
    this.stats.framesSkippedEmpty += this.pendingEmpty.length;
    const frames: FrameQuality[] = this.references.map((r) => {
      const value = this.values[r.index];
      if (!value)
        throw new Error('An analyzed frame is missing its detector scores.');
      return {
        timestampMs: r.timestampMs,
        ...value,
        ...(r.reused ? { reused: true as const } : {}),
      };
    });
    return { frames, stats: this.stats };
  }
}
