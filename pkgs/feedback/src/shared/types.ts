export type Diagnostic =
  | {
      readonly name: string;
      readonly status: 'available';
      readonly value: unknown;
    }
  | {
      readonly name: string;
      readonly status: 'unavailable';
      readonly reason: string;
    };

export type FeedbackKind = 'problem' | 'feature' | 'gap' | 'polish';

export interface FeedbackDraft {
  readonly kind: FeedbackKind;
  readonly description: string;
  readonly expected: string;
  readonly reproductionSteps: string;
}

export interface ReproductionAction {
  readonly atMs: number;
  readonly type: 'click' | 'input' | 'navigation' | 'pointerdown' | 'pointerup';
  readonly path: string;
  readonly target: string;
  readonly label: string;
  readonly value: string | null;
}

export interface ReproductionRecording {
  readonly version: 1;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly initialContext: readonly Diagnostic[];
  readonly finalContext: readonly Diagnostic[];
  readonly actions: readonly ReproductionAction[];
  readonly truncated: boolean;
}

export interface EvidenceFile {
  readonly name: string;
  readonly contentType: string;
  readonly bytes: Uint8Array;
}

export interface FeedbackAttachment {
  readonly id: string;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
  readonly url: string;
}

export interface FeedbackReport extends FeedbackDraft {
  readonly version: 1;
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly createdAt: string;
  readonly status: 'open';
  readonly diagnostics: readonly Diagnostic[];
  readonly recording: ReproductionRecording | null;
  readonly attachments: readonly FeedbackAttachment[];
}

export interface CreatedIssue {
  readonly id: string;
  readonly url?: string;
  readonly location?: string;
}

/** Destination-neutral port. Enrichment is optional and never affects creation. */
export interface IssueReporter {
  create(report: FeedbackReport): Promise<CreatedIssue>;
  enrich?(issue: CreatedIssue, report: FeedbackReport): Promise<void>;
}

export interface DiagnosticProvider {
  readonly name: string;
  collect(signal: AbortSignal): unknown | Promise<unknown>;
}
