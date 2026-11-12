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

export type DiagnosticProvider = {
  readonly name: string;
  collect(signal: AbortSignal): unknown;
};

export type DebugEventKind = 'navigation' | 'choice' | 'trouble' | 'connection';

/** One thing that happened in the app. Never holds what a person typed. */
export type DebugEvent = {
  readonly at: string;
  readonly kind: DebugEventKind;
  readonly text: string;
};

/** What led up to a bug report: recent events, and details of the device and app. */
export type DebugInfo = {
  readonly events: readonly DebugEvent[];
  readonly details: readonly Diagnostic[];
};

/** A picture as the person's device holds it, before the team has it. */
export type ScreenshotFile = {
  readonly contentType: string;
  readonly bytes: Uint8Array;
};

/** A picture the team holds, at an unlisted address. */
export type Screenshot = {
  readonly contentType: string;
  readonly size: number;
  readonly url: string;
};

/** What a device sends: everything in a bug report except its pictures, which travel beside it. */
export type BugReportSubmission = {
  readonly schema: 'bug-report/v1';
  readonly id: string;
  /** A device identity independent of sign-in, so a guest can report. */
  readonly reporterId: string;
  readonly description: string;
  readonly createdAt: string;
  readonly debugInfo: DebugInfo;
};

export type BugReport = BugReportSubmission & {
  readonly screenshots: readonly Screenshot[];
};

export type CreatedIssue = {
  readonly id: string;
  readonly url?: string;
  readonly location?: string;
};

/** Where a bug report becomes an issue for the team. */
export type IssueReporter = {
  create(report: BugReport): Promise<CreatedIssue>;
};
