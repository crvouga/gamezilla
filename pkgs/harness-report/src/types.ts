import type { HtmlReportBundle } from '@pkgs/harness';

/** Bundle plus document title for the standalone / Solid report viewer. */
export type ReportData = HtmlReportBundle & {
  readonly title: string;
};
