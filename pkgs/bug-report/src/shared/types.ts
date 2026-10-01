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

export interface BugReport {
  readonly version: 1;
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly createdAt: string;
  readonly status: 'open';
  readonly diagnostics: readonly Diagnostic[];
}

export interface CreatedIssue {
  readonly id: string;
  readonly url?: string;
  readonly location?: string;
}

/** Destination-neutral port. Enrichment is optional and never affects creation. */
export interface IssueReporter {
  create(report: BugReport): Promise<CreatedIssue>;
  enrich?(issue: CreatedIssue, report: BugReport): Promise<void>;
}

export interface DiagnosticProvider {
  readonly name: string;
  collect(signal: AbortSignal): unknown | Promise<unknown>;
}
