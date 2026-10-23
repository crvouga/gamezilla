import { expect, test } from 'bun:test';
import { SharedObjectStore } from '@libs/app-root-server-ts/shared-object-store';
import { readUtf8, writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';

test('shared data survives environment storage changes and prefix operations address the shared store', async () => {
  const shared = new ObjectStoreImplInMemory();
  const local = new ObjectStoreImplInMemory();
  const other = new ObjectStoreImplInMemory();
  const a = new SharedObjectStore(local, shared);
  const b = new SharedObjectStore(other, shared);
  await writeUtf8(a, 'audio/one', 'local');
  await writeUtf8(b, 'audio/one', 'other');
  await writeUtf8(
    a.withPrefix('shared/chess'),
    'file.csv',
    'shared puzzles',
    'text/csv'
  );
  expect(await readUtf8(b, 'shared/chess/file.csv')).toBe('shared puzzles');
  expect(await readUtf8(a, 'audio/one')).toBe('local');
  expect(await readUtf8(b, 'audio/one')).toBe('other');
  expect(await local.head('shared/chess/file.csv')).toBe(false);
  expect(await a.listKeys('shared/chess/')).toEqual(['shared/chess/file.csv']);
  expect(await a.withPrefix('shared').listKeys()).toEqual(['chess/file.csv']);
  expect(await a.listKeys()).toEqual(['audio/one', 'shared/chess/file.csv']);
  await a.deleteMany(['audio/one']);
  expect(await b.head('shared/chess/file.csv')).toBe(true);
  await b.withPrefix('shared/chess').delete('file.csv');
  expect(await a.head('shared/chess/file.csv')).toBe(false);
});

test('missing shared credentials never send reference-data writes into an environment bucket', () => {
  const environment = new ObjectStoreImplInMemory();
  const store = new SharedObjectStore(environment, null);
  expect(() => store.get('shared/chess/file.csv')).toThrow(
    'Shared data storage is not configured'
  );
  expect(() =>
    store.put('shared/chess/file.csv', new Uint8Array(), 'text/csv')
  ).toThrow('Shared data storage is not configured');
});
