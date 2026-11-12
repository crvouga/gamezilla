import { createRuntime } from '@crvouga/mockingbird-service-github';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import { createBugReportHttpApp } from '@pkgs/feedback-server-ts/bug-report-http-app';
import { GitHubBugReportRecords } from '@pkgs/feedback-server-ts/github-bug-report-records';
import { objectStoreBugReportAttachments } from '@pkgs/feedback-server-ts/object-store-bug-reports';
import type {
  BugReport,
  BugReportRecords,
} from '@pkgs/feedback-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';

export const EXAMPLE_ORIGIN = 'http://local';

const GITHUB = 'http://github.mock';
const REPOSITORY = 'team/app';
const OUTAGE = 'example-team-not-receiving';
const PAGE = 100;
const AS_THE_TEAM = { headers: { Authorization: 'Bearer example' } };

/** A bug report on the team's list of work: the issue GitHub holds, and the full report it links to. */
export type ReceivedBugReport = {
  readonly report: BugReport | null;
  readonly issue: string;
  readonly labels: readonly string[];
  /** When it landed on the team's list of work. */
  readonly receivedAt: string;
};

type Issue = {
  readonly number: number;
  readonly body?: string | null;
  readonly labels?: readonly { name: string }[];
  readonly created_at: string;
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
  const reports = new Map<string, BugReport>();
  let lastSent: (() => Promise<Response>) | null = null;
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
  const writer = new GitHubBugReportRecords({
    http: listOfWork,
    token: 'example',
    repository: REPOSITORY,
    environment: 'example',
    apiOrigin: GITHUB,
  });
  /** Every issue on the list of work, as anyone on the team would read them back from GitHub. */
  async function readIssues(): Promise<Issue[]> {
    await repositoryMade;
    const issues: Issue[] = [];
    for (let page = 1; ; page++) {
      const response = await listOfWork.fetch(
        `${GITHUB}/repos/${REPOSITORY}/issues?state=all&per_page=${PAGE}&page=${page}`,
        AS_THE_TEAM
      );
      const listed = (await response.json()) as readonly Issue[];
      issues.push(...listed);
      if (listed.length < PAGE) break;
    }
    return issues.sort((a, b) => a.number - b.number);
  }
  const records: BugReportRecords = {
    async find(id) {
      await repositoryMade;
      return writer.find(id);
    },
    async countOnDay(day, reporterId) {
      await repositoryMade;
      return writer.countOnDay(day, reporterId);
    },
    async record(report) {
      await repositoryMade;
      const created = await writer.record(report);
      reports.set(created.id, report);
      return created;
    },
    check: () => writer.check(),
  };
  const server = createBugReportHttpApp({
    store: {
      records,
      attachments: objectStoreBugReportAttachments(
        new ObjectStoreImplInMemory()
      ),
    },
    clock,
    allowedOrigins: [EXAMPLE_ORIGIN],
  });
  const http: HttpClient = {
    fetch(input, init) {
      // Without the device's own deadline, so it can be sent again after it.
      const { signal: _signal, ...sent } = init ?? {};
      lastSent = () => server(new Request(input, sent));
      return server(new Request(input, init));
    },
  };
  return {
    http,
    /** The bug reports on the team's list of work, oldest first. */
    async received(): Promise<readonly ReceivedBugReport[]> {
      return (await readIssues()).map((issue) => ({
        report: reports.get(String(issue.number)) ?? null,
        issue: issue.body ?? '',
        labels: (issue.labels ?? []).map((label) => label.name),
        receivedAt: issue.created_at,
      }));
    },
    /** What the device last sent arrives once more, as after an answer that got lost. */
    async receiveAgain(): Promise<void> {
      await lastSent?.();
    },
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
