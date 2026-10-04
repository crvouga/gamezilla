import type { RgbImage } from '../detectors/types';

export interface DecodedFrame extends RgbImage {
  readonly timestampMs: number;
}
export interface VideoDecoder {
  readonly version: string;
  open(
    input: string,
    options: { samplingFps: number; signal?: AbortSignal }
  ): Promise<{
    readonly durationMs: number;
    readonly frames: AsyncIterable<DecodedFrame>;
  }>;
}
