import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql, { raw } from '@pkgs/sql-root-shared/sql';
import { z } from 'zod';
import type { UserRecord } from './records';
import { jsonValue } from './records';
import { USER_COLUMNS } from './synthetic-population-repository';

export const syntheticPopulationDirectoryQuery = z.object({
  q: z.string().max(128).default(''),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

/** Search the complete directory; a page never limits population accounting. */
export async function readSyntheticPopulationDirectory(
  db: SqlTx,
  input: z.infer<typeof syntheticPopulationDirectoryQuery>
) {
  const term = `%${input.q.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`;
  const after = input.cursor ?? '';
  const rows = await db.query(sql<UserRecord>`
    SELECT ${raw(USER_COLUMNS)} FROM population_users
    WHERE deleted_at IS NULL AND id > ${after}
      AND LOWER(username || ' ' || id || ' ' || activity || ' ' || region || ' ' || COALESCE(worker_id, '')) LIKE ${term} ESCAPE ${'\\'}
    ORDER BY id LIMIT ${input.limit + 1}
  `);
  const page = rows.slice(0, input.limit);
  return {
    users: page.map(({ inspection: _inspection, ...row }) => ({
      ...row,
      paused: Boolean(row.paused),
      checkpoint: jsonValue(row.checkpoint) as UserRecord['checkpoint'],
    })),
    nextCursor: rows.length > input.limit ? page.at(-1)!.id : null,
  };
}
