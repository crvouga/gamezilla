import { expect, test } from 'bun:test';
import { assertOpfsPoolUnlocked } from '@pkgs/sql-client-sqlite-web-client-ts/opfs-pool-preflight';
import { OpfsSahPoolBackend } from '@pkgs/sql-client-sqlite-web-client-ts/opfs-sah-pool-backend';
import type { Sqlite3Static } from '@pkgs/sql-client-sqlite-web-shared-ts/oo1-sql-client';

// regression: opfs-locked-initializer-deletes-pending-work
test('contention is rejected before calling the destructive SAH-pool initializer', async () => {
  let initialized = 0;
  const sqlite = {
    installOpfsSAHPoolVfs: () => {
      initialized += 1;
      throw new Error('The failed initializer would remove the existing pool');
    },
  } as unknown as Sqlite3Static;
  const locked = new Error(
    'InvalidStateError: The object is in an invalid state.'
  );
  const backend = new OpfsSahPoolBackend(sqlite, () => Promise.reject(locked));
  await expect(backend.open('user_740c685e6cc0')).rejects.toBe(locked);
  expect(initialized).toBe(0);
});

function poolFiles(args: {
  readonly locked: boolean;
  readonly closed: string[];
}): FileSystemDirectoryHandle {
  const pool = {
    async *values() {
      yield { kind: 'file', name: 'first' };
      yield { kind: 'file', name: 'second' };
    },
    getFileHandle: (name: string) =>
      Promise.resolve({
        createSyncAccessHandle: () =>
          name === 'second' && args.locked
            ? Promise.reject(
                new Error(
                  'InvalidStateError: The object is in an invalid state.'
                )
              )
            : Promise.resolve({
                close: () => {
                  args.closed.push(name);
                },
              }),
      }),
  };
  return {
    getDirectoryHandle: (name: string) => {
      expect(name).toBe('sqlite-web');
      return Promise.resolve({
        getDirectoryHandle: (dbName: string) => {
          expect(dbName).toBe('user_740c685e6cc0');
          return Promise.resolve(pool);
        },
      });
    },
  } as unknown as FileSystemDirectoryHandle;
}

// regression: opfs-locked-initializer-deletes-pending-work
test('a partial probe releases its handles and propagates contention without modifying files', async () => {
  const closed: string[] = [];
  await expect(
    assertOpfsPoolUnlocked(
      'user_740c685e6cc0',
      poolFiles({ locked: true, closed })
    )
  ).rejects.toThrow('InvalidStateError');
  expect(closed).toEqual(['first']);
});

test('a successful probe releases every handle before the pool initializer can open them', async () => {
  const closed: string[] = [];
  await assertOpfsPoolUnlocked(
    'user_740c685e6cc0',
    poolFiles({ locked: false, closed })
  );
  expect(closed).toEqual(['first', 'second']);
});

test('an absent pool is a fresh database while permission errors remain failures', async () => {
  const failure = new Error('The existing pool cannot be accessed');
  const absent = Object.assign(new Error('No pool exists yet'), {
    name: 'NotFoundError',
  });
  const root = (error: unknown) =>
    ({
      getDirectoryHandle: () => Promise.reject(error),
    }) as unknown as FileSystemDirectoryHandle;
  await expect(
    assertOpfsPoolUnlocked('user_740c685e6cc0', root(absent))
  ).resolves.toBeUndefined();
  await expect(
    assertOpfsPoolUnlocked('user_740c685e6cc0', root({ name: 'NotFoundError' }))
  ).resolves.toBeUndefined();
  await expect(
    assertOpfsPoolUnlocked('user_740c685e6cc0', root(failure))
  ).rejects.toBe(failure);
});
