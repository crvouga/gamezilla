import type {
  CreatedIssue,
  FeedbackReport,
  IssueReporter,
} from '../shared/types';

export class FakeIssueReporter implements IssueReporter {
  readonly reports = new Map<string, FeedbackReport>();
  create(report: FeedbackReport): Promise<CreatedIssue> {
    this.reports.set(report.id, structuredClone(report));
    return Promise.resolve({ id: report.id });
  }
  enrich(issue: CreatedIssue, report: FeedbackReport): Promise<void> {
    this.reports.set(issue.id, structuredClone(report));
    return Promise.resolve();
  }
}
