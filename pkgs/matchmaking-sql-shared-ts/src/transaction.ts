import type {
  SqlClient,
  SqlTx,
} from '@pkgs/sql-client-root-shared-ts/interface';

/** Re-execute only transactions PostgreSQL confirms were aborted, with the same command identity. */
export async function matchmakingTransaction<T>(
  db: SqlClient,
  body: (tx: SqlTx) => Promise<T>
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.transaction(body);
    } catch (cause) {
      const code =
        typeof cause === 'object' && cause !== null && 'code' in cause
          ? cause.code
          : null;
      if (attempt >= 7 || (code !== '40001' && code !== '40P01')) throw cause;
    }
  }
}
