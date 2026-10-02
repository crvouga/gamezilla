import type { DetectorInfo, ImageInput, QualityDetector } from './detectors/types';

export interface CheckerOptions {
  readonly threshold?: number;
  readonly batchSize?: number;
  readonly concurrency?: number;
  readonly samplingFps?: number;
  /** Mean RGB difference [0,1] on a 64×64 thumbnail; zero disables deduplication. */
  readonly dedupeThreshold?: number;
  readonly aggregation?: 'minimum' | 'confirmed';
  readonly confirmationWindowMs?: number;
  readonly maxWorstFrames?: number;
  readonly ignoreEmptyFrames?: boolean;
  readonly ignoreRegions?: readonly { startMs: number; endMs: number }[];
  readonly modelDir?: string;
  readonly provider?: 'auto' | 'cpu' | 'webgpu' | 'coreml' | 'cuda' | 'dml';
  readonly detectors?: readonly QualityDetector[];
  readonly cacheDir?: string;
  readonly artifactsDir?: string;
  readonly failureClipMs?: number;
  readonly ffmpegPath?: string;
  readonly signal?: AbortSignal;
}

export interface FrameQuality {
  readonly timestampMs: number;
  readonly quality: number;
  /** The frame reused an earlier near-identical frame's score. */
  readonly reused?: true;
  readonly detectorScores: readonly { detector: string; quality: number; evidence?: string }[];
}

export interface FrameQualityFailure extends FrameQuality {
  readonly artifact?: string;
  readonly clip?: string;
}

export interface DetectorResult extends DetectorInfo {
  readonly pass: boolean;
  readonly score: number;
}

export interface QualityResult {
  readonly schemaVersion: 1;
  readonly packageVersion: '0.1.0';
  readonly kind: 'image' | 'video';
  readonly input: string;
  readonly pass: boolean;
  readonly score: number;
  readonly worstScore: number;
  readonly threshold: number;
  readonly thresholdSource: 'explicit' | 'experimental';
  readonly summary: string;
  readonly framesAnalyzed: number;
  readonly candidateFrames: number;
  readonly framesSkippedEmpty: number;
  readonly framesSkippedIgnored: number;
  readonly framesDeduplicated: number;
  readonly durationMs: number;
  readonly frames: readonly FrameQuality[];
  readonly worstFrames: readonly FrameQualityFailure[];
  readonly failures: readonly FrameQualityFailure[];
  readonly detectors: readonly DetectorResult[];
  readonly cacheKey?: string;
}

export interface BatchQualityResult {
  readonly schemaVersion: 1;
  readonly pass: boolean;
  readonly summary: string;
  readonly results: readonly QualityResult[];
}

export interface UIQualityChecker {
  readonly detectors: readonly DetectorInfo[];
  checkImage(input: ImageInput): Promise<QualityResult>;
  checkImages(inputs: readonly ImageInput[]): Promise<BatchQualityResult>;
  checkVideo(input: string): Promise<QualityResult>;
  checkVideos(inputs: readonly string[]): Promise<BatchQualityResult>;
  check(inputs: readonly string[]): Promise<BatchQualityResult>;
  dispose(): Promise<void>;
}
