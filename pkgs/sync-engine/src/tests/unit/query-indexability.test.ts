import { describe, expect, test } from 'bun:test';
import {
  analyzeIndexability,
  assertIndexableWorkload,
  pkSchemaIndexes,
} from '@pkgs/db-indexes';
import { sql } from '@pkgs/sql';
import {
  assertQueryRegistryIndexable,
  defineQuery,
  extractWorkload,
  queryRegistry,
} from '../../shared';
import {
  foldersOnlyQuery,
  notesAllQuery,
  ownProfileQuery,
} from '../apps/acme/shared/queries';

describe('query indexability (toy)', () => {
  test('WHERE user_id = ? passes', async () => {
    const q = defineQuery({
      name: 'byUser',
      async run(ctx) {
        const rows = await ctx.db.query(
          sql`SELECT id FROM notes WHERE user_id = ${ctx.env.actorId}`
        );
        return { notes: rows };
      },
    });
    await assertQueryRegistryIndexable(queryRegistry([q]), {
      schemaIndexes: pkSchemaIndexes(['notes']),
      catalogTables: new Set(),
    });
  });

  test('unfiltered SELECT on spaces throws', async () => {
    const q = defineQuery({
      name: 'allSpaces',
      async run(ctx) {
        const rows = await ctx.db.query(sql`SELECT id FROM spaces`);
        return { spaces: rows };
      },
    });
    await expect(
      assertQueryRegistryIndexable(queryRegistry([q]), {
        schemaIndexes: pkSchemaIndexes(['spaces']),
        catalogTables: new Set(),
      })
    ).rejects.toThrow(/UNINDEXABLE/);
  });

  test('PK WHERE id = ? passes', async () => {
    const q = defineQuery({
      name: 'byId',
      async run(ctx) {
        const rows = await ctx.db.query(
          sql`SELECT id FROM profile WHERE id = ${ctx.env.actorId}`
        );
        return { profile: rows };
      },
    });
    await assertQueryRegistryIndexable(queryRegistry([q]), {
      schemaIndexes: pkSchemaIndexes(['profile']),
      catalogTables: new Set(),
    });
  });
});

describe('query indexability (acme)', () => {
  test('ownProfile is PK-scoped', async () => {
    await assertQueryRegistryIndexable(queryRegistry([ownProfileQuery]), {
      schemaIndexes: pkSchemaIndexes(['profile']),
      catalogTables: new Set(),
    });
  });

  test('notesAll / foldersOnly require catalog allowlist', async () => {
    const registry = queryRegistry([notesAllQuery, foldersOnlyQuery]);
    await expect(
      assertQueryRegistryIndexable(registry, {
        schemaIndexes: pkSchemaIndexes(['notes', 'folders']),
        catalogTables: new Set(),
      })
    ).rejects.toThrow(/UNINDEXABLE/);

    await assertQueryRegistryIndexable(registry, {
      schemaIndexes: pkSchemaIndexes(['notes', 'folders']),
      catalogTables: new Set(['notes', 'folders']),
    });
  });

  test('extractWorkload + analyze gaps empty when catalogs listed', async () => {
    const registry = queryRegistry([notesAllQuery, ownProfileQuery]);
    const manifest = await extractWorkload(registry);
    const report = analyzeIndexability({
      manifest,
      schemaIndexes: pkSchemaIndexes(['notes', 'folders', 'profile']),
      catalogTables: new Set(['notes', 'folders']),
    });
    expect(report.gaps).toEqual([]);
    expect(() =>
      assertIndexableWorkload({
        manifest,
        schemaIndexes: pkSchemaIndexes(['notes', 'folders', 'profile']),
        catalogTables: new Set(['notes', 'folders']),
      })
    ).not.toThrow();
  });
});
