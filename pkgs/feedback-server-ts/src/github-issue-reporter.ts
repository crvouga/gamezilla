import type {
  BugReport,
  CreatedIssue,
  IssueReporter,
} from '@pkgs/feedback-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import {
  type BugReportIssueOptions,
  bugReportIssue,
  MAX_ISSUE_BODY,
} from './issue-body';

/** How the team and its agents find bug reports among the issues. */
export const BUG_REPORT_LABELS: readonly string[] = ['bug', 'bug-report'];

const GITHUB_API_ORIGIN = 'https://api.github.com';
const PAGE = 100;
/** Issues looked through for one already filed, newest updated first. */
const MAX_PAGES = 10;

type Issue = { number?: unknown; html_url?: unknown; body?: unknown };

/** Hidden in the issue, so a bug report filed once is found, never filed twice. */
export function bugReportMarker(reportId: string): string {
  return `<!-- bug-report:${reportId} -->`;
}

function created(result: Issue): CreatedIssue {
  if (typeof result.number !== 'number' || typeof result.html_url !== 'string')
    throw new Error('Invalid issue response');
  return { id: String(result.number), url: result.html_url };
}

/** GitHub credentials and repository selection stay with whoever files issues. */
export class GitHubIssueReporter implements IssueReporter {
  constructor(
    private readonly options: {
      readonly http: HttpClient;
      readonly token: string;
      readonly repository: string;
      /** GitHub itself unless a simulated GitHub is named. */
      readonly apiOrigin?: string;
      /** Where the full report can be read back, without a trailing slash. */
      readonly reportBaseUrl?: string;
      /** The environment the bug reports came from, labelled `env:<name>`. */
      readonly environment?: string;
      readonly notes?: BugReportIssueOptions['notes'];
    }
  ) {
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(options.repository))
      throw new Error('Invalid issue repository');
    if (
      options.environment !== undefined &&
      !/^[a-z0-9-]{1,40}$/.test(options.environment)
    )
      throw new Error('Invalid environment');
  }

  private issuesUrl(): string {
    const origin = this.options.apiOrigin ?? GITHUB_API_ORIGIN;
    return `${origin}/repos/${this.options.repository}/issues`;
  }

  private headers(): Record<string, string> {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.options.token}`,
      'X-GitHub-Api-Version': '2026-03-10',
      'User-Agent': 'bug-reports',
      'Content-Type': 'application/json',
    };
  }

  private labels(): readonly string[] {
    const { environment } = this.options;
    return environment === undefined
      ? BUG_REPORT_LABELS
      : [...BUG_REPORT_LABELS, `env:${environment}`];
  }

  /**
   * The issue already filed for this bug report, if any. Read from the issue
   * list rather than search, which can lag behind a just-made issue: every
   * issue for it was made, so updated, after it was received.
   */
  private async existing(
    report: BugReport,
    receivedAt: string
  ): Promise<CreatedIssue | null> {
    const marker = bugReportMarker(report.id);
    const query = new URLSearchParams({
      labels: 'bug-report',
      state: 'all',
      since: receivedAt,
      per_page: String(PAGE),
    });
    for (let page = 1; page <= MAX_PAGES; page++) {
      query.set('page', String(page));
      const response = await this.options.http.fetch(
        `${this.issuesUrl()}?${query}`,
        { headers: this.headers() }
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`GitHub would not list issues: ${response.status}`);
      }
      const issues = (await response.json()) as readonly Issue[];
      const found = issues.find(
        (issue) => typeof issue.body === 'string' && issue.body.includes(marker)
      );
      if (found) return created(found);
      if (issues.length < PAGE) return null;
    }
    return null;
  }

  async create(report: BugReport, receivedAt: string): Promise<CreatedIssue> {
    const filed = await this.existing(report, receivedAt);
    if (filed) return filed;
    const marker = bugReportMarker(report.id);
    const issue = bugReportIssue(report, {
      repository: this.options.repository,
      ...(this.options.reportBaseUrl
        ? { reportUrl: `${this.options.reportBaseUrl}/${report.id}` }
        : {}),
      ...(this.options.notes ? { notes: this.options.notes } : {}),
    });
    const response = await this.options.http.fetch(this.issuesUrl(), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        title: issue.title,
        body: `${marker}\n${issue.body}`.slice(0, MAX_ISSUE_BODY),
        labels: this.labels(),
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`GitHub refused the issue: ${response.status}`);
    }
    return created((await response.json()) as Issue);
  }
}
