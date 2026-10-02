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

export type FeedbackDraft = {
  readonly kind: FeedbackKind;
  readonly title: string;
  readonly body: string;
};

export type FeedbackSection = {
  readonly heading: string | null;
  readonly content: string;
};

export type FeedbackBody = {
  readonly format: 'markdown';
  readonly source: string;
  readonly sections: readonly FeedbackSection[];
};

export type ReproductionAction = {
  readonly atMs: number;
  readonly type:
    | 'click'
    | 'input'
    | 'navigation'
    | 'pointerdown'
    | 'pointerup'
    | 'keydown';
  readonly path: string;
  readonly target: string;
  readonly label: string;
  readonly value: string | null;
  readonly point: { readonly x: number; readonly y: number } | null;
};

export type ReproductionRecording = {
  readonly version: 1;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly initialContext: readonly Diagnostic[];
  readonly finalContext: readonly Diagnostic[];
  readonly actions: readonly ReproductionAction[];
  readonly truncated: boolean;
};

export type EvidenceFile = {
  readonly name: string;
  readonly contentType: string;
  readonly bytes: Uint8Array;
};

export type FeedbackAttachment = {
  readonly id: string;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
  readonly url: string;
};

export type FeedbackReport = {
  readonly schema: 'feedback.report/v2';
  readonly id: string;
  readonly title: string;
  readonly kind: FeedbackKind;
  readonly body: FeedbackBody;
  readonly createdAt: string;
  readonly status: 'open' | 'deleted';
  readonly authorId: string;
  readonly diagnostics: readonly Diagnostic[];
  readonly recording: ReproductionRecording | null;
  readonly attachments: readonly FeedbackAttachment[];
};

export type CreatedIssue = {
  readonly id: string;
  readonly url?: string;
  readonly location?: string;
  readonly nodeId?: string;
};

/** Destination-neutral port. Enrichment is optional and never affects creation. */
export type IssueReporter = {
  create(report: FeedbackReport): Promise<CreatedIssue>;
  enrich?(issue: CreatedIssue, report: FeedbackReport): Promise<void>;
};

export type DiagnosticProvider = {
  readonly name: string;
  collect(signal: AbortSignal): unknown;
};

/** Authorship scope is an unlisted device identity, independent of app accounts. */
export type FeedbackRepository = IssueReporter & {
  list(authorId: string): Promise<readonly FeedbackReport[]>;
  read(id: string, authorId: string): Promise<FeedbackReport | null>;
  update(report: FeedbackReport): Promise<CreatedIssue>;
  remove(id: string, authorId: string): Promise<void>;
};
