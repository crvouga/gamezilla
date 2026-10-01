import type { CreatedIssue, FeedbackReport, FeedbackRepository } from '../shared/types';

export class FakeIssueReporter implements FeedbackRepository {
  readonly reports = new Map<string, FeedbackReport>();
  create(report: FeedbackReport): Promise<CreatedIssue> {
    this.reports.set(report.id, structuredClone(report));
    return Promise.resolve({ id: report.id });
  }
  enrich(issue: CreatedIssue, report: FeedbackReport): Promise<void> {
    this.reports.set(issue.id, structuredClone(report));
    return Promise.resolve();
  }
  list(authorId: string): Promise<readonly FeedbackReport[]> {
    return Promise.resolve([...this.reports.values()].filter(r => r.authorId === authorId && r.status !== 'deleted').map(r => structuredClone(r)));
  }
  read(id: string, authorId: string): Promise<FeedbackReport | null> {
    const report = this.reports.get(id);
    return Promise.resolve(report?.authorId === authorId && report.status !== 'deleted' ? structuredClone(report) : null);
  }
  async update(report: FeedbackReport): Promise<CreatedIssue> {
    const previous = await this.read(report.id, report.authorId);
    if (!previous) throw new Error('Feedback belongs to another developer or is unavailable.');
    return this.create({ ...report, createdAt: previous.createdAt });
  }
  async remove(id: string, authorId: string): Promise<void> {
    const previous = await this.read(id, authorId);
    if (!previous) throw new Error('Feedback belongs to another developer or is unavailable.');
    this.reports.set(id, { ...previous, status: 'deleted' });
  }
}
