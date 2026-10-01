import type { HttpClient } from '@pkgs/http-client/types';
import type { BugReport, CreatedIssue, IssueReporter } from '../shared/types';
import { reportMarkdown } from './report-files';

/** GitHub credentials and repository selection stay entirely on the backend. */
export class GitHubIssueReporter implements IssueReporter {
  constructor(
    private readonly options: {
      readonly http: HttpClient;
      readonly token: string;
      readonly repository: string;
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
          'User-Agent': 'bug-reporting',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: report.title,
          body: `${reportMarkdown(report)}\n\n<details><summary>Diagnostics</summary>\n\n\`\`\`json\n${JSON.stringify(report.diagnostics, null, 2).slice(0, 20_000)}\n\`\`\`\n</details>`,
        }),
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
