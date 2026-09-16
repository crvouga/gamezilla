import type { HtmlReportBundle } from '@pkgs/sim';

/** Bundle plus document title for the standalone / Solid report viewer. */
export type ReportData = HtmlReportBundle & {
  readonly title: string;
};
