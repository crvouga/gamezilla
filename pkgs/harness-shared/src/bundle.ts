/**
 * A report test with its frame files in memory: what a viewer renders. Text
 * media are inline, binary media base64.
 */

import type { ReportTestStatus, RunReport } from './report-types';

/** One embedded frame file: text media inline, binary media as base64. */
export type HtmlReportBlob = {
  readonly contentType: string;
  readonly text?: string;
  readonly base64?: string;
};

export type HtmlReportTest = {
  readonly report: RunReport;
  /** Keyed by the blob's `file` (relative to the test dir). */
  readonly blobs: Readonly<Record<string, HtmlReportBlob>>;
};

export type HtmlReportBundle = {
  readonly runId: string;
  readonly status: ReportTestStatus;
  readonly updatedAtMs: number;
  readonly tests: readonly HtmlReportTest[];
};
