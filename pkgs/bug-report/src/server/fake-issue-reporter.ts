import type { BugReport, CreatedIssue, IssueReporter } from '../shared/types';

export class FakeIssueReporter implements IssueReporter {
  readonly reports = new Map<string, BugReport>();
  async create(report: BugReport): Promise<CreatedIssue> {
    this.reports.set(report.id, structuredClone(report));
    return { id: report.id };
  }
  async enrich(issue: CreatedIssue, report: BugReport): Promise<void> {
    this.reports.set(issue.id, structuredClone(report));
  }
}
