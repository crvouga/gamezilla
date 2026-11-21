import { createRuntime } from '@crvouga/mockingbird-service-github';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import { createBugReportHttpApp } from '@pkgs/feedback-server-ts/bug-report-http-app';
import { fileBugReportIssues } from '@pkgs/feedback-server-ts/file-bug-report-issues';
import { GitHubIssueReporter } from '@pkgs/feedback-server-ts/github-issue-reporter';
import { reconcileFeedbackPostgres } from '@pkgs/feedback-server-ts/reconcile';
import type { BugReport } from '@pkgs/feedback-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { readUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server-ts/impl-mockingbird-postgres';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';

export const EXAMPLE_ORIGIN = 'http://local';

const GITHUB = 'http://github.mock';
const REPOSITORY = 'team/app';
const OUTAGE = 'example-list-of-work-unavailable';
const PAGE = 100;
const AS_THE_TEAM = { headers: { Authorization: 'Bearer example' } };

/** A bug report the team has: the full report and what the team reads of it. */
export type ReceivedBugReport = {
  readonly report: BugReport | null;
  /** What the team reads: the bug report written out the way its issue shows it. */
  readonly issue: string;
  /** When the team received it. */
  readonly receivedAt: string;
};

/** A bug report on the team's list of work: the issue as GitHub holds it. */
export type IssueOnListOfWork = {
  readonly issue: string;
  readonly labels: readonly string[];
};

type Issue = {
  readonly number: number;
  readonly body?: string | null;
  readonly labels?: readonly { name: string }[];
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

async function openQueue(clock: Clock): Promise<SqlClient> {
  const db = SqlClientImplMockingbirdPostgres.open({
    seed: 1,
    now: () => new Date(clock.now()),
  });
  await db.connect();
  await reconcileFeedbackPostgres(db);
  return db;
}

/** A store that refuses to keep anything while the team cannot receive. */
function storeThatCanStop(): {
  readonly store: ObjectStoreImplInMemory;
  setKeeping(next: boolean): void;
} {
  const store = new ObjectStoreImplInMemory();
  const put = store.put.bind(store);
  let keeping = true;
  store.put = (key, bytes, contentType) =>
    keeping
      ? put(key, bytes, contentType)
      : Promise.reject(new Error('Storage is unavailable'));
  return {
    store,
    setKeeping(next) {
      keeping = next;
    },
  };
}

/** The issue tracker, simulated as GitHub keeps issues, with its own way of failing. */
function createListOfWork(clock: Clock) {
  const gitHub = createRuntime({ clock: serviceClock(clock), seed: 1 });
  const http: HttpClient = {
    fetch: (input, init) => gitHub.fetch(new Request(input, init)),
  };
  const [owner, name] = REPOSITORY.split('/');
  const made = http.fetch(`${GITHUB}/__admin/github/repositories`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ owner, name }),
  });
  return {
    http,
    made,
    /** Every issue, as anyone on the team would read them back from GitHub. */
    async issues(): Promise<Issue[]> {
      await made;
      const issues: Issue[] = [];
      for (let page = 1; ; page++) {
        const response = await http.fetch(
          `${GITHUB}/repos/${REPOSITORY}/issues?state=all&per_page=${PAGE}&page=${page}`,
          AS_THE_TEAM
        );
        const listed = (await response.json()) as readonly Issue[];
        issues.push(...listed);
        if (listed.length < PAGE) break;
      }
      return issues.sort((a, b) => a.number - b.number);
    },
    setAvailable(next: boolean): void {
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

/**
 * The team's side, whole and in memory: the real intake keeping bug reports
 * in Postgres and a bucket, and the real filing job making them issues on a
 * simulated GitHub. The job runs after every bug report arrives and whenever
 * the example says it has run since.
 */
export function createExampleTeam(clock: Clock) {
  let lastSent: (() => Promise<Response>) | null = null;
  /** Ids in the order they were received: virtual time gives many the same instant. */
  const arrivals: string[] = [];
  const queue = openQueue(clock);
  const { store, setKeeping } = storeThatCanStop();
  const listOfWork = createListOfWork(clock);
  const reporter = new GitHubIssueReporter({
    http: listOfWork.http,
    token: 'example',
    repository: REPOSITORY,
    apiOrigin: GITHUB,
  });
  async function file(): Promise<void> {
    await listOfWork.made;
    await fileBugReportIssues({
      db: await queue,
      store,
      reporter,
      clock,
      limit: PAGE,
    });
  }
  async function receive(request: Request): Promise<Response> {
    const response = await createBugReportHttpApp({
      db: await queue,
      store,
      clock,
      allowedOrigins: [EXAMPLE_ORIGIN],
    })(request);
    if (response.status === 201)
      arrivals.push(((await response.clone().json()) as { id: string }).id);
    await file();
    return response;
  }
  const http: HttpClient = {
    fetch(input, init) {
      // Without the device's own deadline, so it can be sent again after it.
      const { signal: _signal, ...sent } = init ?? {};
      lastSent = () => receive(new Request(input, sent));
      return receive(new Request(input, init));
    },
  };
  return {
    http,
    /** The bug reports the team has received, oldest first. */
    async received(): Promise<readonly ReceivedBugReport[]> {
      const rows = await (await queue).query(sql<{
        id: string;
        archive_key: string;
        received_at: unknown;
      }>`
        SELECT id, archive_key, received_at FROM feedback_bug_reports
      `);
      const order = (id: string) => arrivals.indexOf(id);
      return Promise.all(
        [...rows].sort((a, b) => order(a.id) - order(b.id)).map(async (row) => {
          const json = await readUtf8(store, `${row.archive_key}/report.json`);
          return {
            report: json === null ? null : (JSON.parse(json) as BugReport),
            issue: (await readUtf8(store, `${row.archive_key}/report.md`)) ?? '',
            receivedAt:
              row.received_at instanceof Date
                ? row.received_at.toISOString()
                : String(row.received_at),
          };
        })
      );
    },
    /** The bug reports on the team's list of work, oldest first. */
    async listOfWork(): Promise<readonly IssueOnListOfWork[]> {
      return (await listOfWork.issues()).map((issue) => ({
        issue: issue.body ?? '',
        labels: (issue.labels ?? []).map((label) => label.name),
      }));
    },
    /** The filing job runs, as it does on its own every few minutes. */
    file,
    /** What the device last sent arrives once more, as after an answer that got lost. */
    async receiveAgain(): Promise<void> {
      await lastSent?.();
    },
    setReceiving(next: boolean): void {
      setKeeping(next);
    },
    setListOfWorkAvailable(next: boolean): void {
      listOfWork.setAvailable(next);
    },
  };
}
