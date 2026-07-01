import { SqlClientImplBunSqlite } from '@pkgs/sql-client/impl-bun-sqlite';
import type { PlaygroundDbFactory } from './playground-sim';

/**
 * In-memory Bun SQLite factory for playground sim tests in CI.
 * Each label gets a dedicated `:memory:` database for the sim lifetime.
 */
export function bunPlaygroundDbFactory(): PlaygroundDbFactory {
  const openByLabel = new Map<string, SqlClientImplBunSqlite>();

  return {
    async create(label) {
      const existing = openByLabel.get(label);
      if (existing !== undefined) {
        await existing.disconnect().catch(() => {});
        openByLabel.delete(label);
      }
      const client = SqlClientImplBunSqlite.open(':memory:');
      openByLabel.set(label, client);
      return client;
    },
    async reopen(label) {
      const existing = openByLabel.get(label);
      if (existing !== undefined) {
        return existing;
      }
      const client = SqlClientImplBunSqlite.open(':memory:');
      openByLabel.set(label, client);
      return client;
    },
    async remove(label) {
      const existing = openByLabel.get(label);
      if (existing !== undefined) {
        await existing.disconnect().catch(() => {});
        openByLabel.delete(label);
      }
    },
    async removeAll(labels) {
      await Promise.all(labels.map((label) => this.remove(label)));
    },
  };
}
