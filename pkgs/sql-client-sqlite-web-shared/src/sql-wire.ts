import type { RawValue } from '@pkgs/sql-shared/sql';
import { Sql } from '@pkgs/sql-shared/sql';
import type { SqlWire } from './rpc';

/** Rebuild a {@link Sql} from wire `{ sql, values }` (placeholders are `?`). */
export function sqlFromWire<
  T extends Record<string, unknown> = Record<string, unknown>,
>(wire: SqlWire): Sql<T> {
  const strings = wire.sql.split('?');
  return new Sql<T>(strings, wire.values as readonly RawValue[]);
}
