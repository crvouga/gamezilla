import type { IssueReporter } from '@pkgs/feedback-shared-ts/types';

/** Development has no issue tracker: the archived report is the issue. */
export const localIssueReporter: IssueReporter = {
  create: (report) =>
    Promise.resolve({
      id: report.id,
      location: `reports/${report.id}/report.md`,
    }),
};
