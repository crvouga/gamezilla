import { describe, expect, test } from 'bun:test';
import { defineTable, registerTables } from '@pkgs/db-schema';
import {
  fingerprintForIndexDef,
  indexFingerprintName,
} from '@pkgs/db-schema/core/index-fingerprint';
import { planServer } from '@pkgs/db-schema/core/plan';
import type { IntrospectedCatalog } from '@pkgs/db-schema/core/types';
import { createRecordingPostgresClient } from '@pkgs/db-schema/test/fake-sql-client';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { postgres } from '../src/driver';

const INDEX_DDL = /CREATE INDEX|DROP INDEX/i;
const CREATE_INDEX = /CREATE INDEX/i;
const CREATE_TABLE = /CREATE TABLE/i;

function indexedSchema() {
  return registerTables([
    defineTable({
      domain: 'notes',
      name: 'notes',
      columns: { body: 'text' },
      indexes: ['body'],
    }),
  ]);
}

describe('postgres index reconcile phases', () => {
  const dbScope = createPostgresDbScope('index_phase');

  test("indexPhase 'skip' emits no index DDL", async () => {
    const client = createRecordingPostgresClient(dbScope);
    await postgres(indexedSchema(), client, {
      skipAdvisoryLock: true,
      indexPhase: 'skip',
    }).reconcile();

    const indexDdl = client.calls.filter(
      (c) => c.kind === 'run' && INDEX_DDL.test(c.sql)
    );
    expect(indexDdl).toEqual([]);
  });

  test("indexPhase 'only' emits only index DDL, no CREATE TABLE", async () => {
    const client = createRecordingPostgresClient(dbScope);
    await postgres(indexedSchema(), client, {
      skipAdvisoryLock: true,
      indexPhase: 'only',
    }).reconcile();

    const runs = client.calls.filter((c) => c.kind === 'run');
    expect(runs.some((c) => CREATE_INDEX.test(c.sql))).toBe(true);
    expect(runs.some((c) => CREATE_TABLE.test(c.sql))).toBe(false);
    expect(runs.some((c) => /DROP INDEX/i.test(c.sql))).toBe(false);
  });

  test('inline alreadyInTransaction emits non-CONCURRENTLY index DDL', async () => {
    const client = createRecordingPostgresClient(dbScope);
    await postgres(indexedSchema(), client, {
      skipAdvisoryLock: true,
      alreadyInTransaction: true,
    }).reconcile();

    const creates = client.calls.filter(
      (c) => c.kind === 'run' && CREATE_INDEX.test(c.sql)
    );
    expect(creates.length).toBeGreaterThan(0);
    expect(creates.every((c) => !/CONCURRENTLY/i.test(c.sql))).toBe(true);
  });

  test('inline outside a transaction emits CREATE INDEX CONCURRENTLY', async () => {
    const client = createRecordingPostgresClient(dbScope);
    await postgres(indexedSchema(), client, {
      skipAdvisoryLock: true,
    }).reconcile();

    const creates = client.calls.filter(
      (c) => c.kind === 'run' && CREATE_INDEX.test(c.sql)
    );
    expect(creates.length).toBeGreaterThan(0);
    expect(creates.every((c) => /CONCURRENTLY/i.test(c.sql))).toBe(true);
  });
});

describe('postgres index-only planner', () => {
  test('plans creates, stale drops, and invalid drops', () => {
    const declared = registerTables([
      defineTable({
        domain: 'notes',
        name: 'notes',
        columns: { body: 'text', slug: 'text' },
        indexes: ['body'],
      }),
    ]);
    const declaredIndex = fingerprintForIndexDef(['notes', 'body'], false);
    const staleIndex = indexFingerprintName('notes', ['slug'], false);

    const catalog: IntrospectedCatalog = {
      tables: new Map(),
      indexes: [
        { name: staleIndex, table: 'notes', columns: ['slug'] },
        {
          name: declaredIndex,
          table: 'notes',
          columns: ['body'],
          invalid: true,
        },
      ],
      allTableNames: new Set(['notes']),
    };

    const plan = planServer(declared._declared, catalog, {
      operations: 'index',
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    expect(
      plan.operations.every(
        (o) => o.kind === 'create_index' || o.kind === 'drop_index'
      )
    ).toBe(true);

    const drops = plan.operations
      .filter(
        (o): o is Extract<typeof o, { kind: 'drop_index' }> =>
          o.kind === 'drop_index'
      )
      .map((o) => o.name);
    expect(drops).toContain(staleIndex);
    // A catalog index flagged invalid is dropped even when its name is declared.
    expect(drops).toContain(declaredIndex);

    const creates = plan.operations
      .filter(
        (o): o is Extract<typeof o, { kind: 'create_index' }> =>
          o.kind === 'create_index'
      )
      .map((o) => o.name);
    expect(creates).toContain(declaredIndex);
    expect(creates).not.toContain(staleIndex);

    // The invalid index still occupies its name, so its drop must come before
    // the create that reclaims the name.
    const order = plan.operations.map((o) => `${o.kind}:${o.name}`);
    const dropAt = order.indexOf(`drop_index:${declaredIndex}`);
    const createAt = order.indexOf(`create_index:${declaredIndex}`);
    expect(dropAt).toBeGreaterThanOrEqual(0);
    expect(createAt).toBeGreaterThan(dropAt);
  });
});
