import { describe } from 'bun:test';
import { wallTimers } from '@pkgs/clock';
import type { SqlClient } from '../interface';
import { SqlClientImplBunSqlite } from './impl-bun-sqlite';
import { SqlClientImplSqliteMem } from './impl-sqlite-mem';
import { runSqliteContractTests } from './testing/sqlite-contract';

type ClientFactory = () => Promise<SqlClient>;

async function loadImplementations(): Promise<
  { name: string; createClient: ClientFactory }[]
> {
  const impls: { name: string; createClient: ClientFactory }[] = [
    {
      name: 'SqlClientImplSqliteMem',
      createClient: async () => SqlClientImplSqliteMem.open(),
    },
    {
      name: 'SqlClientImplBunSqlite',
      createClient: () =>
        Promise.resolve(SqlClientImplBunSqlite.open(':memory:')),
    },
  ];

  // better-sqlite3 is for Node/Jest sims; its native addon NAPI-crashes under Bun.
  // Only probe outside Bun so Node runners still cover it.
  if (typeof Bun === 'undefined') {
    try {
      const { SqlClientImplBetterSqlite } = await import(
        './impl-better-sqlite3'
      );
      impls.push({
        name: 'SqlClientImplBetterSqlite',
        createClient: () =>
          Promise.resolve(SqlClientImplBetterSqlite.open(':memory:')),
      });
    } catch {
      // optional native dep unavailable
    }
  }

  try {
    const { SqlClientImplExpoSqlite } = await import('./impl-expo-sqlite');
    impls.push({
      name: 'SqlClientImplExpoSqlite',
      createClient: () => SqlClientImplExpoSqlite.open(':memory:', wallTimers),
    });
  } catch {
    // expo-sqlite requires React Native runtime; skip in Bun test env
  }

  return impls;
}

const implementations = await loadImplementations();

describe.each(implementations)(
  'SQLite contract — $name',
  ({ createClient }) => {
    runSqliteContractTests(createClient);
  }
);
