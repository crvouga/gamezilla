import { expect, test } from 'bun:test';
import type { DesiredClientConfig } from '@libs/app-config-server/ensure-client-config-materialized';
import { EnsureClientConfigMaterialized } from '@libs/app-config-server/ensure-client-config-materialized';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';

const desired: DesiredClientConfig = {
  google: true,
  apple: true,
  billing: true,
  tts: false,
  llm: false,
  googleWebClientId: null,
  emqxWssUrl: null,
  permissionPolicy: {},
  billingGracePeriodMs: 0,
};

function database(failure: object) {
  let attempts = 0;
  const db: SqlClient = {
    connect: async () => undefined,
    disconnect: async () => undefined,
    query: async () => [],
    run: async () => ({ changes: 1, lastInsertRowid: 0 }),
    prepare: () => {
      throw new Error('unused');
    },
    transaction: async (body) => {
      attempts++;
      if (attempts === 1) throw failure;
      return body(db);
    },
  };
  return { db, attempts: () => attempts };
}

// regression: client-config-concurrent-materialization
test('materialization recovers a PostgreSQL-confirmed serialization abort', async () => {
  const fixture = database({
    code: '40001',
    message: 'could not serialize access due to concurrent update',
  });
  const service = new EnsureClientConfigMaterialized(
    fixture.db,
    createHarnessClock().clock
  );
  expect(await service.execute(desired)).toEqual({ updated: true });
  expect(fixture.attempts()).toBe(2);
});

test('materialization propagates permanent failures without repeating writes', async () => {
  const failure = { code: '23505' };
  const fixture = database(failure);
  const service = new EnsureClientConfigMaterialized(
    fixture.db,
    createHarnessClock().clock
  );
  await expect(service.execute(desired)).rejects.toEqual(failure);
  expect(fixture.attempts()).toBe(1);
});
