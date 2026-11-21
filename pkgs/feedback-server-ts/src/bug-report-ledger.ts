import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';

/** A received bug report, as the team's queue of reports to file holds it. */
export type ReceivedRow = {
  readonly id: string;
  readonly reporterId: string;
  readonly receivedAt: string;
  readonly archiveKey: string;
  readonly attempts: number;
};

type Row = {
  id: string;
  reporter_id: string;
  received_at: unknown;
  archive_key: string;
  attempts: unknown;
};

/** Postgres hands back a Date or a string, depending on the driver. */
function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toReceived(row: Row): ReceivedRow {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    receivedAt: iso(row.received_at),
    archiveKey: row.archive_key,
    attempts: Number(row.attempts),
  };
}

/** Whether the queue answers at all. */
export async function pingLedger(db: SqlTx): Promise<void> {
  await db.query(sql<{ id: string }>`
    SELECT id FROM feedback_bug_reports LIMIT 1
  `);
}

export async function findReceived(
  db: SqlTx,
  id: string
): Promise<ReceivedRow | null> {
  const [row] = await db.query(sql<Row>`
    SELECT id, reporter_id, received_at, archive_key, attempts
      FROM feedback_bug_reports
     WHERE id = ${id} AND deleted_at IS NULL
  `);
  return row ? toReceived(row) : null;
}

/** How many bug reports were received on `day`, all told and from one device. */
export async function countReceived(
  db: SqlTx,
  day: string,
  reporterId: string
): Promise<{ readonly all: number; readonly fromDevice: number }> {
  const [row] = await db.query(sql<{ all_count: unknown; own: unknown }>`
    SELECT COUNT(*) AS all_count,
           COALESCE(SUM(CASE WHEN reporter_id = ${reporterId} THEN 1 ELSE 0 END), 0) AS own
      FROM feedback_bug_reports
     WHERE received_day = ${day} AND deleted_at IS NULL
  `);
  return { all: Number(row?.all_count ?? 0), fromDevice: Number(row?.own ?? 0) };
}

/** Records a received bug report; false when its id was already taken. */
export async function recordReceived(
  db: SqlTx,
  row: Omit<ReceivedRow, 'attempts'>
): Promise<boolean> {
  const result = await db.run(sql`
    INSERT INTO feedback_bug_reports (
      id, reporter_id, received_day, received_at, archive_key, issue_url,
      filed_at, attempts, next_attempt_at, last_error,
      created_at, updated_at, deleted_at
    ) VALUES (
      ${row.id}, ${row.reporterId}, ${row.receivedAt.slice(0, 10)},
      ${row.receivedAt}, ${row.archiveKey}, ${null},
      ${null}, ${0}, ${null}, ${null},
      ${row.receivedAt}, ${row.receivedAt}, ${null}
    )
    ON CONFLICT (id) DO NOTHING
  `);
  return result.changes > 0;
}

/** Received bug reports not yet filed whose next attempt is due, oldest first. */
export async function dueToFile(
  db: SqlTx,
  now: string,
  limit: number
): Promise<readonly ReceivedRow[]> {
  const rows = await db.query(sql<Row>`
    SELECT id, reporter_id, received_at, archive_key, attempts
      FROM feedback_bug_reports
     WHERE filed_at IS NULL AND deleted_at IS NULL
       AND (next_attempt_at IS NULL OR next_attempt_at <= ${now})
     ORDER BY received_at, id
     LIMIT ${limit}
  `);
  return rows.map(toReceived);
}

export async function markFiled(
  db: SqlTx,
  filed: { readonly id: string; readonly issueUrl: string; readonly at: string }
): Promise<void> {
  await db.run(sql`
    UPDATE feedback_bug_reports
       SET issue_url = ${filed.issueUrl}, filed_at = ${filed.at},
           last_error = ${null}, updated_at = ${filed.at}
     WHERE id = ${filed.id}
  `);
}

export async function markNotFiled(
  db: SqlTx,
  failed: {
    readonly id: string;
    readonly attempts: number;
    readonly error: string;
    readonly at: string;
    readonly retryAt: string;
  }
): Promise<void> {
  await db.run(sql`
    UPDATE feedback_bug_reports
       SET attempts = ${failed.attempts}, last_error = ${failed.error},
           next_attempt_at = ${failed.retryAt}, updated_at = ${failed.at}
     WHERE id = ${failed.id}
  `);
}
