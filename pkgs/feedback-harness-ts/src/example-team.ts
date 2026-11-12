import type { Clock } from '@pkgs/clock-shared-ts/types';
import { createBugReportHttpApp } from '@pkgs/feedback-server-ts/bug-report-http-app';
import { GitHubIssueReporter } from '@pkgs/feedback-server-ts/github-issue-reporter';
import type { BugReport, IssueReporter } from '@pkgs/feedback-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';

export const EXAMPLE_ORIGIN = 'http://local';

/** A bug report on the team's list of work: what was sent, and the issue as written. */
export type ReceivedBugReport = {
  readonly report: BugReport;
  readonly issue: string;
};

/**
 * The team's side, whole and in memory: the real intake and the real issue
 * writer, in front of a list of work that stands in for GitHub.
 */
export function createExampleTeam(clock: Clock) {
  const received: ReceivedBugReport[] = [];
  let issue = '';
  let receiving = true;
  const listOfWork: HttpClient = {
    fetch(_input, init) {
      if (!receiving)
        return Promise.resolve(new Response('Unavailable', { status: 503 }));
      const sent = typeof init?.body === 'string' ? init.body : '{}';
      issue = (JSON.parse(sent) as { body?: string }).body ?? '';
      const number = received.length + 1;
      return Promise.resolve(
        Response.json(
          { number, html_url: `https://github.com/team/app/issues/${number}` },
          { status: 201 }
        )
      );
    },
  };
  const writer = new GitHubIssueReporter({
    http: listOfWork,
    token: 'example',
    repository: 'team/app',
  });
  const reporter: IssueReporter = {
    async create(report) {
      const created = await writer.create(report);
      received.push({ report, issue });
      return created;
    },
  };
  const server = createBugReportHttpApp({
    reporter,
    store: new ObjectStoreImplInMemory(),
    clock,
    allowedOrigin: EXAMPLE_ORIGIN,
  });
  const http: HttpClient = {
    fetch: (input, init) => server(new Request(input, init)),
  };
  return {
    http,
    received: (): readonly ReceivedBugReport[] => received,
    setReceiving(next: boolean): void {
      receiving = next;
    },
  };
}
