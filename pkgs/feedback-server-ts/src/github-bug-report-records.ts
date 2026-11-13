import { BUG_REPORT_ID } from '@pkgs/feedback-shared-ts/bug-report';
import type {
  BugReport,
  BugReportRecords,
  CreatedIssue,
  DailyBugReports,
  ReceivedBugReport,
} from '@pkgs/feedback-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { type BugReportIssueOptions, bugReportIssue } from './issue-body';

/** How the team and its agents find bug reports among the issues. */
export const BUG_REPORT_LABELS: readonly string[] = ['bug', 'bug-report'];

const GITHUB_API_ORIGIN = 'https://api.github.com';
const MAX_ISSUE_BODY = 65_536;
const PAGE = 100;
/** Pages of one day's issues read before the day's ceiling is surely reached. */
const MAX_PAGES = 6;
/**
 * Where an issue says which report it records, first in its body so no
 * shortening loses it. Only issues carrying the labels count, and only the
 * team can label, so no one else can claim a report's id.
 */
const MARKER =
  /^<!-- bug-report id=([0-9a-fA-F-]{36}) reporter=([0-9a-fA-F-]{36}) -->/;

export type GitHubBugReportRecordsOptions = {
  readonly http: HttpClient;
  readonly token: string;
  readonly repository: string;
  /** The environment the reports come from (`prd`, `dev`), as the label `env:<environment>`. */
  readonly environment: string;
  /** GitHub itself unless a simulated GitHub is named. */
  readonly apiOrigin?: string;
  /** Where the full report can be read back, without a trailing slash. */
  readonly reportBaseUrl?: string;
  readonly notes?: BugReportIssueOptions['notes'];
};

type Issue = {
  readonly number?: unknown;
  readonly html_url?: unknown;
  readonly body?: unknown;
  readonly created_at?: unknown;
};

function markerOf(issue: Issue) {
  const marker =
    typeof issue.body === 'string' ? MARKER.exec(issue.body) : null;
  return marker?.[1] && marker[2]
    ? { id: marker[1], reporterId: marker[2] }
    : null;
}

function received(issue: Issue, id: string): ReceivedBugReport | null {
  const marker = markerOf(issue);
  if (
    marker?.id !== id ||
    typeof issue.number !== 'number' ||
    typeof issue.html_url !== 'string'
  )
    return null;
  return {
    reporterId: marker.reporterId,
    issue: { id: String(issue.number), url: issue.html_url },
  };
}

/**
 * Bug reports recorded as GitHub issues, GitHub being their only record: an
 * issue is found again by the marker it opens with, and a day's reports are
 * counted from the newest issues, which GitHub lists without the lag of its
 * search. Credentials stay on the backend.
 */
export class GitHubBugReportRecords implements BugReportRecords {
  private readonly labels: readonly string[];

  constructor(private readonly options: GitHubBugReportRecordsOptions) {
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(options.repository))
      throw new Error('Invalid issue repository');
    if (!/^[a-z0-9-]+$/.test(options.environment))
      throw new Error('Invalid bug report environment');
    this.labels = [...BUG_REPORT_LABELS, `env:${options.environment}`];
  }

  private url(path: string): string {
    return `${this.options.apiOrigin ?? GITHUB_API_ORIGIN}${path}`;
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

  private async read<T>(path: string): Promise<T> {
    const response = await this.options.http.fetch(this.url(path), {
      headers: this.headers(),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`GitHub refused to answer: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  /** This environment's bug report issues, newest first. */
  private newest(page: number): Promise<readonly Issue[]> {
    const labels = encodeURIComponent(this.labels.slice(1).join(','));
    return this.read<readonly Issue[]>(
      `/repos/${this.options.repository}/issues?labels=${labels}&state=all&sort=created&direction=desc&per_page=${PAGE}&page=${page}`
    );
  }

  async find(id: string): Promise<ReceivedBugReport | null> {
    if (!BUG_REPORT_ID.test(id)) return null;
    // A report sent again soon is among the newest; the search index may lag.
    const newest = await this.newest(1);
    const found = newest.map((issue) => received(issue, id)).find(Boolean);
    if (found) return found;
    const query = [
      `repo:${this.options.repository}`,
      'is:issue',
      ...this.labels.slice(1).map((label) => `label:"${label}"`),
      `"${id}" in:body`,
    ].join(' ');
    const { items = [] } = await this.read<{ items?: readonly Issue[] }>(
      `/search/issues?q=${encodeURIComponent(query)}&per_page=10`
    );
    return items.map((issue) => received(issue, id)).find(Boolean) ?? null;
  }

  async countOnDay(day: string, reporterId: string): Promise<DailyBugReports> {
    let fromDevice = 0;
    let total = 0;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const issues = await this.newest(page);
      for (const issue of issues) {
        const created =
          typeof issue.created_at === 'string'
            ? issue.created_at.slice(0, 10)
            : '';
        if (created < day) return { fromDevice, total };
        if (created !== day) continue;
        total++;
        if (markerOf(issue)?.reporterId === reporterId) fromDevice++;
      }
      if (issues.length < PAGE) break;
    }
    return { fromDevice, total };
  }

  /**
   * Whether an issue could be opened right now, asked without opening one:
   * GitHub refuses an issue with no title as unprocessable (422) only after
   * it has let the token write to the repository.
   */
  async check(): Promise<void> {
    const response = await this.options.http.fetch(
      this.url(`/repos/${this.options.repository}/issues`),
      { method: 'POST', headers: this.headers(), body: '{}' }
    );
    // Only the status is the answer; the rest is let go so nothing is held.
    await response.body?.cancel();
    if (response.status !== 422)
      throw new Error(`GitHub would not take an issue: ${response.status}`);
  }

  async record(report: BugReport): Promise<CreatedIssue> {
    const issue = bugReportIssue(report, {
      repository: this.options.repository,
      ...(this.options.reportBaseUrl
        ? { reportUrl: `${this.options.reportBaseUrl}/${report.id}` }
        : {}),
      ...(this.options.notes ? { notes: this.options.notes } : {}),
    });
    const marker = `<!-- bug-report id=${report.id} reporter=${report.reporterId} -->`;
    const response = await this.options.http.fetch(
      this.url(`/repos/${this.options.repository}/issues`),
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          title: issue.title,
          body: `${marker}\n\n${issue.body}`.slice(0, MAX_ISSUE_BODY),
          labels: this.labels,
        }),
      }
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`GitHub refused the issue: ${response.status}`);
    }
    const created = (await response.json()) as Issue;
    if (
      typeof created.number !== 'number' ||
      typeof created.html_url !== 'string'
    )
      throw new Error('Invalid issue response');
    return { id: String(created.number), url: created.html_url };
  }
}
