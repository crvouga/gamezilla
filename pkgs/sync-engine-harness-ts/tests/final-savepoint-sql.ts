import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';

export function observeFinalSavepointSql(inner: SqlClient) {
  const statements: string[] = [];
  let depth = 0;
  let maxDepth = 0;
  let fault: 'none' | 'observability' | 'fanout' = 'none';
  let faultAt = 1;
  let calls = 0;
  const before = (text: string) => {
    statements.push(text);
    const matches =
      fault === 'observability'
        ? text.includes('INSERT INTO sync_engine_observability_events')
        : fault === 'fanout' &&
          text.includes('INSERT INTO sync_engine_topic_seq');
    if (matches && ++calls === faultAt)
      throw new Error('Literal late transaction failure');
  };
  const after = (text: string) => {
    if (text === 'SAVEPOINT sync_engine_mutation')
      maxDepth = Math.max(maxDepth, ++depth);
    if (text === 'RELEASE SAVEPOINT sync_engine_mutation') depth--;
  };
  const wrap = (db: SqlClient): SqlClient => ({
    connect: () => db.connect(),
    disconnect: () => db.disconnect(),
    prepare: (q) => db.prepare(q),
    query: async (q) => {
      before(q.sql);
      const rows = await db.query(q);
      after(q.sql);
      return rows;
    },
    run: async (q) => {
      before(q.sql);
      const result = await db.run(q);
      after(q.sql);
      return result;
    },
    transaction: async (body) => {
      try {
        return await db.transaction((tx) => body(wrap(tx)));
      } finally {
        depth = 0;
      }
    },
  });
  return {
    db: wrap(inner),
    statements,
    maxDepth: () => maxDepth,
    arm: (stage: typeof fault, at = 1) => {
      fault = stage;
      faultAt = at;
      calls = 0;
    },
  };
}
