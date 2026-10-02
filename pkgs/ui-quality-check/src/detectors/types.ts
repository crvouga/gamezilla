export interface RgbImage {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
}

/** Paths and encoded PNG/JPEG bytes are accepted by the public API. */
export type ImageInput = string | Uint8Array | RgbImage;

export interface DetectorInfo {
  readonly id: string;
  readonly version: string;
  readonly executionProvider: string;
}

export interface QualityScore {
  /** Normalized [0, 1]; higher is better. Not a calibrated probability. */
  readonly quality: number;
  readonly evidence?: string;
}

/** Receives decoded RGB, in input order. No framework, browser or application context. */
export interface QualityDetector {
  readonly info: DetectorInfo;
  initialize(): Promise<void>;
  score(images: readonly RgbImage[], signal?: AbortSignal): Promise<readonly QualityScore[]>;
  dispose(): Promise<void>;
}

/** Future temporal detectors can keep bounded state per video via this seam. */
export interface SequenceDetector {
  readonly info: DetectorInfo;
  initialize(): Promise<void>;
  observe(image: RgbImage, timestampMs: number): Promise<void>;
  finish(): Promise<readonly { timestampMs: number; quality: number; evidence: string }[]>;
  dispose(): Promise<void>;
}
