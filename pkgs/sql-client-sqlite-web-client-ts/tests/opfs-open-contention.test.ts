import { expect, test } from 'bun:test';
import { OpfsSahPoolBackend } from '@pkgs/sql-client-sqlite-web-client-ts/opfs-sah-pool-backend';
import type { Sqlite3Static } from '@pkgs/sql-client-sqlite-web-shared-ts/oo1-sql-client';

// regression: opfs-locked-initializer-deletes-pending-work
test('failed pool initialization explicitly preserves existing offline work', async () => {
  let options: unknown;
  const locked = new Error(
    'InvalidStateError: The object is in an invalid state.'
  );
  const sqlite = {
    installOpfsSAHPoolVfs: (input: unknown) => {
      options = input;
      return Promise.reject(locked);
    },
  } as unknown as Sqlite3Static;
  const backend = new OpfsSahPoolBackend(sqlite);
  await expect(backend.open('user_740c685e6cc0')).rejects.toBe(locked);
  expect(options).toMatchObject({
    preserveOnInitFailure: true,
    clearOnInit: false,
  });
});
