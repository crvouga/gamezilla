import { readBytes } from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type {
  CreatedIssue,
  FeedbackReport,
  FeedbackRepository,
} from '../shared/types';
import { agentHandoff, reportDirectory, reportMarkdown } from './report-files';

/** ObjectStore is rooted at the repository's .feedback/; every put commits atomically. */
export class FileSystemIssueReporter implements FeedbackRepository {
  constructor(private readonly store: ObjectStore) {}

  private async write(key: string, value: string, type: string): Promise<void> {
    await this.store.put(key, new TextEncoder().encode(value), type);
  }

  async create(report: FeedbackReport): Promise<CreatedIssue> {
    const directory = reportDirectory(report);
    // A single atomic JSON commit is the authoritative, durable report.
    await this.write(
      `${directory}/report.json`,
      JSON.stringify(report, null, 2),
      'application/json'
    );
    // Companion failure must not turn a persisted report into a failed submission.
    await Promise.allSettled([
      this.write(
        `${directory}/reproduction.json`,
        JSON.stringify(report.recording, null, 2),
        'application/json'
      ),
      this.write(
        `${directory}/AGENT_HANDOFF.md`,
        agentHandoff(report),
        'text/markdown'
      ),
      this.write(
        `${directory}/diagnostics.json`,
        JSON.stringify(report.diagnostics, null, 2),
        'application/json'
      ),
      this.write(
        `${directory}/report.md`,
        reportMarkdown(report),
        'text/markdown'
      ),
      this.write(
        `index/${directory}.json`,
        JSON.stringify(
          {
            id: report.id,
            title: report.title,
            createdAt: report.createdAt,
            status: report.status,
            path: `${directory}/report.md`,
          },
          null,
          2
        ),
        'application/json'
      ),
    ]);
    return { id: report.id, location: `.feedback/${directory}/report.md` };
  }

  async enrich(_issue: CreatedIssue, report: FeedbackReport): Promise<void> {
    const directory = reportDirectory(report);
    await this.write(
      `${directory}/diagnostics.json`,
      JSON.stringify(report.diagnostics, null, 2),
      'application/json'
    );
    await this.write(
      `${directory}/report.json`,
      JSON.stringify(report, null, 2),
      'application/json'
    );
    await this.write(
      `${directory}/report.md`,
      reportMarkdown(report),
      'text/markdown'
    );
  }
  async list(authorId: string): Promise<readonly FeedbackReport[]> {
    const keys = (await this.store.listKeys()).filter((key) =>
      /^feedback-[^/]+\/report.json$/.test(key)
    );
    const reports = await Promise.all(
      keys.map((key) => this.read(key.slice(9, key.indexOf('/')), authorId))
    );
    return reports.filter((r): r is FeedbackReport => r !== null);
  }
  async read(id: string, authorId: string): Promise<FeedbackReport | null> {
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(id))
      throw new Error('Invalid feedback id');
    const object = await this.store.get(`feedback-${id}/report.json`);
    if (!object) return null;
    const report = JSON.parse(
      new TextDecoder().decode(await readBytes(object.body))
    ) as FeedbackReport;
    return report.authorId === authorId && report.status !== 'deleted'
      ? report
      : null;
  }
  async update(report: FeedbackReport): Promise<CreatedIssue> {
    const previous = await this.read(report.id, report.authorId);
    if (!previous)
      throw new Error(
        'Feedback belongs to another developer or is unavailable.'
      );
    return this.create({ ...report, createdAt: previous.createdAt });
  }
  async remove(id: string, authorId: string): Promise<void> {
    const report = await this.read(id, authorId);
    if (!report)
      throw new Error(
        'Feedback belongs to another developer or is unavailable.'
      );
    await this.create({ ...report, status: 'deleted' });
  }
}
