import { expect, test } from 'bun:test';
import { createMockingbirdPostgresSqlClient } from '@pkgs/sql-client-postgres-server-ts/impl-mockingbird-postgres';
import { raw } from '@pkgs/sql-root-shared-ts/sql';

test('a callback sharing its current session can query through the root client', async () => {
  // regression: postgres-simulated-transaction-callback-deadlock
  const { sqlClient } = createMockingbirdPostgresSqlClient({ seed: 1 });
  try {
    const result = await sqlClient.transaction(async (tx) => {
      await tx.run(raw('SAVEPOINT retained_choice'));
      const rows = await sqlClient.query(
        raw<{ one: number }>('SELECT 1 AS one')
      );
      await tx.run(raw('RELEASE SAVEPOINT retained_choice'));
      return rows;
    });
    expect(result).toEqual([{ one: 1 }]);
  } finally {
    await sqlClient.disconnect();
  }
});

test('overlapping callers cannot commit another transaction or lose its savepoint', async () => {
  // regression: postgres-simulated-transactions-share-session
  const { sqlClient } = createMockingbirdPostgresSqlClient({ seed: 1 });
  let resume: () => void = () => undefined;
  let entered: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  try {
    const first = sqlClient.transaction(async (tx) => {
      await tx.run(raw('SAVEPOINT retained_choice'));
      entered();
      await held;
      await tx.run(raw('RELEASE SAVEPOINT retained_choice'));
      return 'first';
    });
    await started;
    const second = sqlClient.transaction(async (tx) => {
      await tx.query(raw<Record<string, unknown>>('SELECT 1'));
      return 'second';
    });
    await Promise.resolve();
    resume();
    expect(await Promise.all([first, second])).toEqual(['first', 'second']);
  } finally {
    resume();
    await sqlClient.disconnect();
  }
});
