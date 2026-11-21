import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { BugReport, IssueReporter } from '@pkgs/feedback-shared-ts/types';
import { readUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import {
  dueToFile,
  markFiled,
  markNotFiled,
  type ReceivedRow,
} from './bug-report-ledger';

const MINUTE_MS = 60_000;
/** The first retry waits this long, each later one twice as long as the last. */
const FIRST_RETRY_MS = 5 * MINUTE_MS;
/** No bug report waits longer than this between tries. */
export const LONGEST_RETRY_MS = 6 * 60 * MINUTE_MS;
const MAX_ERROR_TEXT = 500;

export type FileBugReportIssuesOptions = {
  /** The `feedback_bug_reports` table the intake records received bug reports in. */
  readonly db: SqlTx;
  /** The archive the intake wrote each bug report to. */
  readonly store: ObjectStore;
  readonly reporter: IssueReporter;
  readonly clock: Clock;
  /** At most this many bug reports are filed in one pass. */
  readonly limit: number;
};

export type FiledBugReports = {
  readonly filed: readonly string[];
  readonly failed: readonly { readonly id: string; readonly error: string }[];
};

/** How long to wait before trying a bug report again after `attempts` failures. */
export function retryDelayMs(attempts: number): number {
  return Math.min(
    FIRST_RETRY_MS * 2 ** Math.max(0, attempts - 1),
    LONGEST_RETRY_MS
  );
}

function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, MAX_ERROR_TEXT);
}

async function fileOne(
  options: FileBugReportIssuesOptions,
  row: ReceivedRow
): Promise<void> {
  const text = await readUtf8(options.store, `${row.archiveKey}/report.json`);
  if (text === null) throw new Error('The archived bug report is missing');
  const report = JSON.parse(text) as BugReport;
  const issue = await options.reporter.create(report, row.receivedAt);
  const at = new Date(options.clock.now()).toISOString();
  await markFiled(options.db, {
    id: row.id,
    issueUrl: issue.url ?? issue.location ?? issue.id,
    at,
  });
}

/**
 * Files every received bug report that is due as an issue, oldest first. A
 * bug report that cannot be filed is tried again later, waiting longer each
 * time, and never holds up the others. Filing again after a crash between
 * making the issue and noting it finds the issue instead of making another
 * (`IssueReporter.create`).
 */
export async function fileBugReportIssues(
  options: FileBugReportIssuesOptions
): Promise<FiledBugReports> {
  const now = options.clock.now();
  const due = await dueToFile(
    options.db,
    new Date(now).toISOString(),
    options.limit
  );
  const filed: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const row of due) {
    try {
      await fileOne(options, row);
      filed.push(row.id);
    } catch (error) {
      const attempts = row.attempts + 1;
      const at = options.clock.now();
      failed.push({ id: row.id, error: errorText(error) });
      await markNotFiled(options.db, {
        id: row.id,
        attempts,
        error: errorText(error),
        at: new Date(at).toISOString(),
        retryAt: new Date(at + retryDelayMs(attempts)).toISOString(),
      });
    }
  }
  return { filed, failed };
}
