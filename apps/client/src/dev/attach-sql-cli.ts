import { attachToGlobal } from '@pkgs/sql-cli/attach-to-global';
import { createSqlCli } from '@pkgs/sql-cli/create-sql-cli';
import type { SqlClient } from '@pkgs/sql-client/interface';

/** Metro / Expo set `globalThis.__DEV__ === true` only in development bundles. */
function isExpoDevBundle(): boolean {
  return Reflect.get(globalThis, '__DEV__') === true;
}

/**
 * Attach `window.q` / `globalThis.q` for browser-console SQL against the
 * local SQLite client. No-op outside `__DEV__`.
 */
export function attachSqlCli(client: SqlClient): void {
  if (!isExpoDevBundle()) {
    return;
  }
  const { sql } = createSqlCli({ client });
  attachToGlobal(sql, { name: 'q' });
}
