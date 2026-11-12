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

/** A bug report already received: the device that sent it, and where the team finds it. */
export type ReceivedBugReport = {
  readonly reporterId: string;
  readonly issue: CreatedIssue;
};

/** Bug reports received on one day: from one device, and from every device. */
export type DailyBugReports = {
  readonly fromDevice: number;
  readonly total: number;
};

/**
 * Where received bug reports are recorded and looked up, so the intake never
 * knows where that is: the team's issue tracker, a folder in development, or
 * a database. Every adapter keeps the same promises.
 */
export type BugReportRecords = {
  /** The report received under this id, or null when none was. */
  find(id: string): Promise<ReceivedBugReport | null>;
  /** The reports received on a UTC day (`2026-03-02`). */
  countOnDay(day: string, reporterId: string): Promise<DailyBugReports>;
  /** Records the report once; asked only after {@link find} answered null. */
  record(report: BugReport): Promise<CreatedIssue>;
  /** Settles only if a report could be recorded right now; records none. */
  check(): Promise<void>;
};

/** A file kept with a bug report: its full JSON, or one of its pictures. */
export type BugReportAttachment = {
  readonly contentType: string;
  readonly body: ReadableStream<Uint8Array>;
  readonly size: number;
};

/**
 * Where a bug report's files are kept and served back by unlisted address
 * (`report.json`, `screenshots/1`).
 */
export type BugReportAttachments = {
  put(
    id: string,
    name: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<void>;
  get(id: string, name: string): Promise<BugReportAttachment | null>;
  /** Settles only if files could be kept right now; keeps none. */
  check(): Promise<void>;
};

/** Everything a received bug report needs: its record and its files. */
export type BugReportStore = {
  readonly records: BugReportRecords;
  readonly attachments: BugReportAttachments;
};
