import type { Sql } from '@pkgs/sql';

import { FRAMEWORK_TABLE_NAMES } from '../../shared/framework-server-ddl';
import { type MutationDb, MutationError } from '../core/types';

const FRAMEWORK_TABLE_SET: ReadonlySet<string> = new Set(FRAMEWORK_TABLE_NAMES);

const DELETE_FROM_RE = /\bDELETE\s+FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/i;

/**
 * Reject domain hard deletes on mutation apply/replay.
 * Framework tables may still be deleted; use soft-delete for domain rows.
 */
export function assertNoDomainHardDelete(query: Sql<unknown>): void {
  const text = query.strings.join(' ');
  const match = DELETE_FROM_RE.exec(text);
  if (match === null) return;
  const table = match[1]!;
  if (FRAMEWORK_TABLE_SET.has(table)) return;
  throw new MutationError(
    'NO_HARD_DELETE',
    `Hard DELETE FROM ${table} is forbidden; set _deleted_at instead.`,
    { table }
  );
}

/** Wrap mutation tx so domain `DELETE FROM` throws {@link MutationError}. */
export function wrapMutationDb(tx: MutationDb): MutationDb {
  return {
    query: (query) => {
      assertNoDomainHardDelete(query);
      return tx.query(query);
    },
    run: (query) => {
      assertNoDomainHardDelete(query);
      return tx.run(query);
    },
  };
}
