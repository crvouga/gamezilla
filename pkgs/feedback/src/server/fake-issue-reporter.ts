import type { FeedbackReport, CreatedIssue, IssueReporter } from '../shared/types';

export class FakeIssueReporter implements IssueReporter {
  readonly reports = new Map<string, FeedbackReport>();
  async create(report: FeedbackReport): Promise<CreatedIssue> {
    this.reports.set(report.id, structuredClone(report));
    return { id: report.id };
  }
  async enrich(issue: CreatedIssue, report: FeedbackReport): Promise<void> {
    this.reports.set(issue.id, structuredClone(report));
  }
}
