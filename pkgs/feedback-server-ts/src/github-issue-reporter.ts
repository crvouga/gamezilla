import type {
  BugReport,
  CreatedIssue,
  IssueReporter,
} from '@pkgs/feedback-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { type BugReportIssueOptions, bugReportIssue } from './issue-body';

/** How the team and its agents find bug reports among the issues. */
export const BUG_REPORT_LABELS: readonly string[] = ['bug', 'bug-report'];

/** GitHub credentials and repository selection stay entirely on the backend. */
export class GitHubIssueReporter implements IssueReporter {
  constructor(
    private readonly options: {
      readonly http: HttpClient;
      readonly token: string;
      readonly repository: string;
      /** Where the full report can be read back, without a trailing slash. */
      readonly reportBaseUrl?: string;
      readonly labels?: readonly string[];
      readonly notes?: BugReportIssueOptions['notes'];
    }
  ) {
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(options.repository))
      throw new Error('Invalid issue repository');
  }

  private headers(): Record<string, string> {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.options.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'bug-reports',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Whether an issue could be opened right now, asked without opening one:
   * GitHub refuses an issue with no title as unprocessable (422) only after
   * it has let the token write to the repository.
   */
  async check(): Promise<void> {
    const response = await this.options.http.fetch(
      `https://api.github.com/repos/${this.options.repository}/issues`,
      { method: 'POST', headers: this.headers(), body: '{}' }
    );
    if (response.status !== 422)
      throw new Error(`GitHub would not take an issue: ${response.status}`);
  }

  async create(report: BugReport): Promise<CreatedIssue> {
    const response = await this.options.http.fetch(
      `https://api.github.com/repos/${this.options.repository}/issues`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          ...bugReportIssue(report, {
            repository: this.options.repository,
            ...(this.options.reportBaseUrl
              ? { reportUrl: `${this.options.reportBaseUrl}/${report.id}` }
              : {}),
            ...(this.options.notes ? { notes: this.options.notes } : {}),
          }),
          labels: this.options.labels ?? BUG_REPORT_LABELS,
        }),
      }
    );
    if (!response.ok)
      throw new Error(`GitHub refused the issue: ${response.status}`);
    const result = (await response.json()) as {
      number?: unknown;
      html_url?: unknown;
    };
    if (
      typeof result.number !== 'number' ||
      typeof result.html_url !== 'string'
    )
      throw new Error('Invalid issue response');
    return { id: String(result.number), url: result.html_url };
  }
}
