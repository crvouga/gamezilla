import type { QualityResult } from 'ui-quality-check';

export interface ArtifactOrigin {
  readonly package: string;
  readonly bucket: string;
  readonly test: string;
  readonly title: string;
  readonly step: string;
  readonly source?: string;
  readonly actor?: string;
  readonly timestampMs: number;
  readonly file: string;
}

export interface VisualArtifact {
  readonly hash: string;
  readonly kind: 'html' | 'image' | 'video';
  readonly file: string;
  readonly origins: readonly ArtifactOrigin[];
}

export interface ArtifactManifest {
  readonly schemaVersion: 1;
  readonly artifacts: readonly VisualArtifact[];
  readonly reports: number;
  readonly references: number;
}

export interface ArtifactScore {
  readonly artifact: VisualArtifact;
  readonly result: QualityResult;
  readonly failureImage?: string;
}

export interface VisualGateResult {
  readonly schemaVersion: 1;
  readonly pass: boolean;
  readonly threshold: number;
  readonly thresholdBasis: 'experimental-neutral-prompt-boundary';
  readonly reports: number;
  readonly references: number;
  readonly inputsAnalyzed: number;
  readonly uniqueImagesScored: number;
  readonly results: readonly ArtifactScore[];
}
