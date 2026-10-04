import type {
  CreatedIssue,
  FeedbackReport,
  FeedbackRepository,
} from '@pkgs/feedback-shared/types';
import { readBytes } from '@pkgs/object-store-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-shared/interface';
import { FileSystemIssueReporter } from './filesystem-issue-reporter';
import type { GitHubIssueReporter } from './github-issue-reporter';

/** Durable reports and destination receipts outlive a vendor interruption. */
export class ArchivedIssueReporter implements FeedbackRepository {
  private readonly archive: FileSystemIssueReporter;
  constructor(
    private readonly store: ObjectStore,
    private readonly destination: GitHubIssueReporter
  ) {
    this.archive = new FileSystemIssueReporter(store);
  }
  private async receipt(id: string): Promise<CreatedIssue | null> {
    const object = await this.store.get(`feedback-${id}/destination.json`);
    return object
      ? (JSON.parse(
          new TextDecoder().decode(await readBytes(object.body))
        ) as CreatedIssue)
      : null;
  }
  async create(report: FeedbackReport): Promise<CreatedIssue> {
    const existing = await this.archive.read(report.id, report.authorId);
    if (
      !existing &&
      (await this.store.head(`feedback-${report.id}/report.json`))
    )
      throw new Error(
        'Feedback belongs to another developer or is unavailable.'
      );
    const saved = await this.receipt(report.id);
    if (saved) return saved;
    await this.archive.create(report);
    const issue = await this.destination.create(report);
    await this.store.put(
      `feedback-${report.id}/destination.json`,
      new TextEncoder().encode(JSON.stringify(issue)),
      'application/json'
    );
    return issue;
  }
  async list(authorId: string): Promise<readonly FeedbackReport[]> {
    const reports = await this.archive.list(authorId);
    const receipts = await Promise.all(
      reports.map((report) => this.receipt(report.id))
    );
    return reports.filter((_, index) => receipts[index] !== null);
  }
  read = (id: string, authorId: string) => this.archive.read(id, authorId);
  async update(report: FeedbackReport): Promise<CreatedIssue> {
    const previous = await this.read(report.id, report.authorId);
    if (!previous)
      throw new Error(
        'Feedback belongs to another developer or is unavailable.'
      );
    const receipt = await this.receipt(report.id);
    if (receipt) await this.destination.update(receipt, report);
    else return this.create(report);
    await this.archive.update(report);
    return receipt;
  }
  async remove(id: string, authorId: string): Promise<void> {
    if (!(await this.read(id, authorId)))
      throw new Error(
        'Feedback belongs to another developer or is unavailable.'
      );
    const receipt = await this.receipt(id);
    if (receipt) await this.destination.remove(receipt);
    await this.archive.remove(id, authorId);
  }
}
