import { expect, test } from 'bun:test';
import { describeSpaceLinkOpening } from '@libs/spaces-harness-ts/space-link-diagnosis';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { scopeHash } from '@pkgs/sync-engine-shared-ts/canonical';

test('an invitation timeout distinguishes the server space from the guest’s copy and sync scope', async () => {
  const spaceId = '7a1831a1-2fe8-409c-993a-5344130fba5c';
  const link = `/space/${spaceId}`;
  const local = SqlClientImplBunSqlite.openMemory();
  const server = SqlClientImplBunSqlite.openMemory();
  const state = {
    actors: new Map([['bob', { browser: {}, localSql: () => local }]]),
    harness: { serverSql: { sqlClient: server } },
    session: {
      ports: { timers: { setTimeout: () => 1, clearTimeout: () => {} } },
    },
  };
  const describe = () => describeSpaceLinkOpening(state as never, 'bob', link);
  try {
    for (const db of [local, server]) {
      await db.run(
        sql`CREATE TABLE spaces (id TEXT, visibility TEXT, ended_at TEXT, deleted_at TEXT)`
      );
    }
    await server.run(
      sql`INSERT INTO spaces (id, visibility) VALUES (${spaceId}, 'public')`
    );
    await local.run(
      sql`CREATE TABLE sync_engine_scope_meta (scope_hash TEXT, deleted_at TEXT)`
    );
    const record = (id: string) =>
      local.run(sql`INSERT INTO sync_engine_scope_meta (scope_hash)
      VALUES (${scopeHash('spaceByLink', { spaceId: id })})`);
    await record('another-space');
    expect(await describe()).toBe(
      '; device space=absent, link scope=absent; server space=public'
    );
    await record(spaceId);
    await local.run(
      sql`INSERT INTO spaces (id, visibility) VALUES (${spaceId}, 'public')`
    );
    expect(await describe()).toBe(
      '; device space=present, link scope=applied; server space=public'
    );
  } finally {
    await local.disconnect();
    await server.disconnect();
  }
});
