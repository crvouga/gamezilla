import type { HttpClient } from '@pkgs/http-client-shared/types';
import type {
  CreatedIssue,
  FeedbackReport,
  IssueReporter,
} from '@pkgs/feedback-shared/types';
import { reportMarkdown } from './report-files';

/** GitHub credentials and repository selection stay entirely on the backend. */
export class GitHubIssueReporter implements IssueReporter {
  constructor(
    private readonly options: {
      readonly http: HttpClient;
      readonly token: string;
      readonly repository: string;
      readonly reportBaseUrl?: string;
    }
  ) {
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(options.repository))
      throw new Error('Invalid issue repository');
  }

  async create(report: FeedbackReport): Promise<CreatedIssue> {
    const response = await this.options.http.fetch(
      `https://api.github.com/repos/${this.options.repository}/issues`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.options.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'feedback',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: report.title,
          body: this.body(report),
        }),
      }
    );
    if (!response.ok) throw new Error('Issue destination unavailable');
    const result = (await response.json()) as {
      number?: unknown;
      html_url?: unknown;
      node_id?: string;
    };
    if (
      typeof result.number !== 'number' ||
      typeof result.html_url !== 'string'
    )
      throw new Error('Invalid issue response');
    return {
      id: String(result.number),
      url: result.html_url,
      ...(result.node_id ? { nodeId: result.node_id } : {}),
    };
  }
  async update(issue: CreatedIssue, report: FeedbackReport): Promise<void> {
    if (!/^\d+$/.test(issue.id)) throw new Error('Invalid issue receipt');
    const response = await this.options.http.fetch(
      `https://api.github.com/repos/${this.options.repository}/issues/${issue.id}`,
      {
        method: 'PATCH',
        headers: this.headers(),
        body: JSON.stringify({
          title: report.title,
          body: this.body(report),
        }),
      }
    );
    if (!response.ok) throw new Error('GitHub feedback could not be updated');
  }
  async remove(issue: CreatedIssue): Promise<void> {
    if (!issue.nodeId)
      throw new Error('GitHub issue cannot be deleted without its receipt');
    const response = await this.options.http.fetch(
      'https://api.github.com/graphql',
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          query:
            'mutation DeleteFeedback($id: ID!) { deleteIssue(input: { issueId: $id }) { clientMutationId } }',
          variables: { id: issue.nodeId },
        }),
      }
    );
    const result = (await response.json()) as { errors?: unknown[] };
    if (!response.ok || result.errors?.length)
      throw new Error('GitHub feedback could not be deleted');
  }
  private body(report: FeedbackReport): string {
    return this.options.reportBaseUrl
      ? `${reportMarkdown(report)}\n\nStructured feedback bundle: ${this.options.reportBaseUrl}/${report.id}\n\nRead report.json first, restore the exact starting context and ordered actions, then add a failing host-application regression before fixing the issue.`
      : `${reportMarkdown(report)}\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\``;
  }
  private headers(): Record<string, string> {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.options.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'feedback',
      'Content-Type': 'application/json',
    };
  }
}
