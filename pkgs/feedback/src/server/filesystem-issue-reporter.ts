import type { ObjectStore } from '@pkgs/object-store/interface';
import type {
  CreatedIssue,
  FeedbackReport,
  IssueReporter,
} from '../shared/types';
import { agentHandoff, reportDirectory, reportMarkdown } from './report-files';

/** ObjectStore is rooted at the repository's .feedback/; every put commits atomically. */
export class FileSystemIssueReporter implements IssueReporter {
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
}
