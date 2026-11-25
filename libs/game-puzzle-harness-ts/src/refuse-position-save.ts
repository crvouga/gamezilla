import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
/** Fail just the local position insert, leaving the attempt readable and retryable. */
export async function refusePositionSave(db: SqlTx) {
  await db.run(sql`CREATE TEMP TRIGGER refuse_position_save
    BEFORE INSERT ON puzzle_content_positions BEGIN
    SELECT RAISE(ABORT, 'Device could not save the position'); END`);
  return () => db.run(sql`DROP TRIGGER refuse_position_save`);
}
