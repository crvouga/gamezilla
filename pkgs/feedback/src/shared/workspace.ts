import type {
  CreatedIssue,
  EvidenceFile,
  FeedbackDraft,
  FeedbackReport,
  ReproductionRecording,
} from './types';

export type SavedEvidence = Omit<EvidenceFile, 'bytes'> & {
  readonly key: string;
};
export type FeedbackDocument = FeedbackDraft & {
  readonly id: string;
  readonly report: FeedbackReport | null;
  readonly attempted: FeedbackReport | null;
  readonly issue: CreatedIssue | null;
  readonly recording: ReproductionRecording | null;
  readonly files: readonly SavedEvidence[];
  readonly video: SavedEvidence | null;
};
export type WizardStage = 'write' | 'manage';
export type FeedbackWorkspaceSnapshot = {
  readonly version: 1;
  readonly activeId: string;
  readonly documents: readonly FeedbackDocument[];
  readonly management: {
    readonly search: string;
    readonly filter: 'all' | 'draft' | 'sent';
  };
  readonly stage: WizardStage;
  readonly position: { readonly x: number; readonly y: number };
};
/** Synchronous journal protects the last keystroke even when the app closes. */
export type FeedbackWorkspacePort = {
  load(): FeedbackWorkspaceSnapshot | null;
  save(snapshot: FeedbackWorkspaceSnapshot): void;
};
