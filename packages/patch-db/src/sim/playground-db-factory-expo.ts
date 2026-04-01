import { SqlClientImplExpoSqlite } from '@gamezilla/shared/sql-client/impl-expo-sqlite';
import * as SQLite from 'expo-sqlite';
import type { PlaygroundDbFactory } from './playground-sim';

/**
 * Expo-sqlite factory for the playground app.
 * Each node gets a persistent file-backed database (auto-survives restarts).
 */
export function expoSqlitePlaygroundDbFactory(): PlaygroundDbFactory {
  return {
    async create(label) {
      await SQLite.deleteDatabaseAsync(label).catch(() => {});
      return SqlClientImplExpoSqlite.open(label);
    },
    reopen(label) {
      return SqlClientImplExpoSqlite.open(label);
    },
    async remove(label) {
      await SQLite.deleteDatabaseAsync(label).catch(() => {});
    },
    async removeAll(labels) {
      await Promise.all(
        labels.map((l) => SQLite.deleteDatabaseAsync(l).catch(() => {}))
      );
    },
  };
}
