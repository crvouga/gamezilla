import { createApiObjectStore } from '@libs/app-root-server-ts/object-store';
import { openRequestDb } from '@libs/app-root-server-ts/open-request-db-postgres';
import { createApiSecretStore } from '@libs/app-root-shared-ts/secret-store';
import { appPostgresDbScope } from '@libs/db-shared-ts/scope';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import { BUG_REPORT_PATH } from '@pkgs/feedback-server-ts/bug-report-http-app';
import {
  type FiledBugReports,
  fileBugReportIssues,
} from '@pkgs/feedback-server-ts/file-bug-report-issues';
import { GitHubIssueReporter } from '@pkgs/feedback-server-ts/github-issue-reporter';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';

type Notes = NonNullable<
  ConstructorParameters<typeof GitHubIssueReporter>[0]['notes']
>;

const SESSION = /^[a-zA-Z0-9_-]{8,64}$/;
/** Bug reports filed in one run; the rest wait for the next. */
const PER_RUN = 50;

/** What this repository's own tools make of a bug report. */
const agentNotes: Notes = (report) => {
  const session = report.debugInfo.details.find(
    (detail) => detail.name === 'session'
  );
  const value =
    session?.status === 'available'
      ? (session.value as { sessionId?: unknown } | null)
      : null;
  const sessionId = value?.sessionId;
  return [
    ...(typeof sessionId === 'string' && SESSION.test(sessionId)
      ? [
          `Telemetry of the same visit: \`bun obs find ${sessionId} --source prod\`.`,
        ]
      : []),
    "To fix it, run `/feedback-implement` with this issue's number.",
  ];
};

function required(env: Record<string, string | undefined>, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Set ${name} to file bug reports`);
  return value;
}

/**
 * Files the bug reports one environment has received as GitHub issues. The
 * environment's own Postgres and bucket come from its secrets
 * (`DATABASE_URL`, `S3_*`), read exactly as the Worker that received them
 * reads them; GitHub comes from the job running it (`GITHUB_TOKEN` or
 * `GH_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_API_URL`), never the secret store.
 */
export async function fileEnvironmentBugReports(
  env: Record<string, string | undefined>,
  ports: { readonly http: HttpClient; readonly clock: Clock }
): Promise<FiledBugReports> {
  const environment = required(env, 'SECRETS_ENV');
  const token = env['GITHUB_TOKEN']?.trim() || required(env, 'GH_TOKEN');
  const apiUrl = env['API_URL']?.trim();
  const reporter = new GitHubIssueReporter({
    http: ports.http,
    token,
    repository: required(env, 'GITHUB_REPOSITORY'),
    environment,
    notes: agentNotes,
    ...(env['GITHUB_API_URL']?.trim()
      ? { apiOrigin: env['GITHUB_API_URL'].trim() }
      : {}),
    ...(apiUrl ? { reportBaseUrl: `${apiUrl}${BUG_REPORT_PATH}/reports` } : {}),
  });
  const store = (
    await createApiObjectStore(createApiSecretStore(env, ports.clock.now), {
      now: ports.clock.now,
      http: ports.http,
      requireCredentials: true,
    })
  ).withPrefix('bug-reports');
  const opened = await openRequestDb(
    required(env, 'DATABASE_URL'),
    appPostgresDbScope()
  );
  try {
    return await fileBugReportIssues({
      db: opened.sqlClient,
      store,
      reporter,
      clock: ports.clock,
      limit: PER_RUN,
    });
  } finally {
    if (opened.kind === 'postgres') await opened.pool.end();
  }
}
