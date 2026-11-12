import type {
  BugReport,
  CreatedIssue,
  IssueReporter,
} from '@pkgs/feedback-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { bugReportIssue } from './issue-body';

/** GitHub credentials and repository selection stay entirely on the backend. */
export class GitHubIssueReporter implements IssueReporter {
  constructor(
    private readonly options: {
      readonly http: HttpClient;
      readonly token: string;
      readonly repository: string;
      /** Where the full report can be read back, without a trailing slash. */
      readonly reportBaseUrl?: string;
    }
  ) {
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(options.repository))
      throw new Error('Invalid issue repository');
  }

  async create(report: BugReport): Promise<CreatedIssue> {
    const response = await this.options.http.fetch(
      `https://api.github.com/repos/${this.options.repository}/issues`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.options.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'bug-reports',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          bugReportIssue(
            report,
            this.options.reportBaseUrl
              ? { reportUrl: `${this.options.reportBaseUrl}/${report.id}` }
              : {}
          )
        ),
      }
    );
    if (!response.ok) throw new Error('Issue destination unavailable');
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
