import type { HtmlReportBundle } from '@pkgs/harness-root-shared/bundle';

/** Bundle plus document title for the standalone / Solid report viewer. */
export type ReportData = HtmlReportBundle & {
  readonly title: string;
};
