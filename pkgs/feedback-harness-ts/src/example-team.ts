import { createRuntime } from '@crvouga/mockingbird-service-github';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import { createBugReportHttpApp } from '@pkgs/feedback-server-ts/bug-report-http-app';
import { GitHubIssueReporter } from '@pkgs/feedback-server-ts/github-issue-reporter';
import type { BugReport, IssueReporter } from '@pkgs/feedback-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';

export const EXAMPLE_ORIGIN = 'http://local';

const GITHUB = 'http://github.mock';
const REPOSITORY = 'team/app';
const OUTAGE = 'example-team-not-receiving';

/** A bug report on the team's list of work: what was sent, and the issue GitHub holds. */
export type ReceivedBugReport = {
  readonly report: BugReport;
  readonly issue: string;
  readonly labels: readonly string[];
};

/** Service time is the example's clock; the example moves it, never the service. */
function serviceClock(clock: Clock) {
  return {
    now: () => clock.now(),
    set: () => undefined,
    advance: () => undefined,
    freeze: () => undefined,
    unfreeze: () => undefined,
    reset: () => undefined,
    state: () => ({ now: clock.now(), frozen: false, offsetMs: 0 }),
  };
}

/**
 * The team's side, whole and in memory: the real intake and the real issue
 * writer, in front of a simulated GitHub that keeps the issues as GitHub does.
 */
export function createExampleTeam(clock: Clock) {
  const received: ReceivedBugReport[] = [];
  const gitHub = createRuntime({ clock: serviceClock(clock), seed: 1 });
  const listOfWork: HttpClient = {
    fetch: (input, init) => gitHub.fetch(new Request(input, init)),
  };
  const [owner, name] = REPOSITORY.split('/');
  const repositoryMade = listOfWork.fetch(
    `${GITHUB}/__admin/github/repositories`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ owner, name }),
    }
  );
  const writer = new GitHubIssueReporter({
    http: listOfWork,
    token: 'example',
    repository: REPOSITORY,
    apiOrigin: GITHUB,
  });
  /** The issue as anyone on the team would read it back from GitHub. */
  async function readIssue(number: string) {
    const response = await listOfWork.fetch(
      `${GITHUB}/repos/${REPOSITORY}/issues/${number}`,
      { headers: { Authorization: 'Bearer example' } }
    );
    const issue = (await response.json()) as {
      body?: string | null;
      labels?: readonly { name: string }[];
    };
    return {
      issue: issue.body ?? '',
      labels: (issue.labels ?? []).map((label) => label.name),
    };
  }
  const reporter: IssueReporter = {
    async create(report) {
      await repositoryMade;
      const created = await writer.create(report);
      received.push({ report, ...(await readIssue(created.id)) });
      return created;
    },
  };
  const server = createBugReportHttpApp({
    reporter,
    store: new ObjectStoreImplInMemory(),
    clock,
    allowedOrigins: [EXAMPLE_ORIGIN],
  });
  const http: HttpClient = {
    fetch: (input, init) => server(new Request(input, init)),
  };
  return {
    http,
    received: (): readonly ReceivedBugReport[] => received,
    setReceiving(next: boolean): void {
      if (next) gitHub.faults.remove(OUTAGE);
      else
        gitHub.faults.add({
          id: OUTAGE,
          method: 'POST',
          status: 503,
          body: 'Unavailable',
        });
    },
  };
}
