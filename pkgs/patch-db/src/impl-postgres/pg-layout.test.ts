/**
 * Pure unit tests for {@link computeDesiredPgLayout}. Asserts the shape of
 * the desired layout per schema (per-entity standalone tables, generated
 * columns, single + composite indexes) and the deploy-time crash paths
 * (composite reference to a non-indexed attribute; identifier-length
 * overflow).
 */
import { assert } from '@pkgs/assert';
import { createAttrNamespace } from '@pkgs/attribute';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createEntitySchemaRegistry, defineEntitySchema } from '../schema';
import {
  compositeIndexNameFor,
  generatedColumnNameFor,
  partitionTableName,
  singleColumnIndexNameFor,
} from './partitioning';
import { computeDesiredPgLayout } from './pg-layout';

let disposeCrashHandler: () => void;
beforeAll(() => {
  disposeCrashHandler = assert.registerCrashHandler({
    priority: 5,
    match: () => true,
    crash(message, context) {
      const err = new Error(message);
      Object.assign(err, { context });
      throw err;
    },
  });
});
afterAll(() => {
  disposeCrashHandler();
});

const taskNs = createAttrNamespace('task');
const TaskAttr = {
  id: taskNs.text('id', (v) => String(v ?? '')).indexed({ unique: true }),
  rating: taskNs
    .integer('rating', (v) => Number(v ?? 0))
    .indexed({ sortable: true }),
  status: taskNs.text('status', (v) => String(v ?? '')).indexed(),
  title: taskNs.text('title', (v) => String(v ?? '')),
  themes: taskNs.array('themes', (v) =>
    Array.isArray(v) ? (v as string[]) : []
  ),
};

describe('computeDesiredPgLayout: per-entity tables + generated columns', () => {
  test('one per-entity table per registered schema, keyed by table name', () => {
    const registry = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({ entityType: 'task', attributes: TaskAttr })
      )
      .register(
        defineEntitySchema({
          entityType: 'other',
          attributes: {
            name: taskNs.text('other-name', (v) => String(v ?? '')),
          },
        })
      )
      .freeze();
    const layout = computeDesiredPgLayout(registry);
    expect(layout.tables.size).toBe(2);
    expect(layout.tables.has(partitionTableName('task'))).toBe(true);
    expect(layout.tables.has(partitionTableName('other'))).toBe(true);
  });

  test('only `.indexed()` scalar attributes become generated columns; arrays are skipped', () => {
    const registry = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({ entityType: 'task', attributes: TaskAttr })
      )
      .freeze();
    const layout = computeDesiredPgLayout(registry);
    const table = layout.tables.get(partitionTableName('task'));
    expect(table).toBeDefined();
    expect(table?.generatedColumns.size).toBe(3);
    expect(
      table?.generatedColumns.has(
        generatedColumnNameFor('task', TaskAttr.id.key)
      )
    ).toBe(true);
    expect(
      table?.generatedColumns.has(
        generatedColumnNameFor('task', TaskAttr.rating.key)
      )
    ).toBe(true);
    expect(
      table?.generatedColumns.has(
        generatedColumnNameFor('task', TaskAttr.status.key)
      )
    ).toBe(true);
  });

  test('every generated column gets one single-column btree, named `<col>_idx`', () => {
    const registry = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({ entityType: 'task', attributes: TaskAttr })
      )
      .freeze();
    const layout = computeDesiredPgLayout(registry);
    const table = layout.tables.get(partitionTableName('task'));
    expect(table?.singleIndexes.size).toBe(3);
    const ratingColName = generatedColumnNameFor('task', TaskAttr.rating.key);
    const ratingIdxName = singleColumnIndexNameFor(ratingColName);
    const ratingIdx = table?.singleIndexes.get(ratingIdxName);
    expect(ratingIdx?.columnName).toBe(ratingColName);
  });

  test('each per-entity table carries a per-table GIN index name', () => {
    const registry = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({ entityType: 'task', attributes: TaskAttr })
      )
      .freeze();
    const layout = computeDesiredPgLayout(registry);
    const table = layout.tables.get(partitionTableName('task'));
    expect(table?.ginIndexName).toMatch(/^pdb_gin_task__attrs$/);
  });
});

describe('computeDesiredPgLayout: composite indexes', () => {
  test('composite spec resolves attribute keys to their generated-column identifiers', () => {
    const registry = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({
          entityType: 'task',
          attributes: TaskAttr,
          composite: [
            {
              name: 'rating-status',
              fields: [
                { tag: TaskAttr.rating, direction: 'desc' },
                { tag: TaskAttr.status },
              ],
            },
          ],
        })
      )
      .freeze();
    const layout = computeDesiredPgLayout(registry);
    const table = layout.tables.get(partitionTableName('task'));
    expect(table?.compositeIndexes.size).toBe(1);
    const indexName = compositeIndexNameFor('task', 'rating-status');
    const composite = table?.compositeIndexes.get(indexName);
    expect(composite?.localName).toBe('rating-status');
    expect(composite?.columns).toEqual([
      {
        columnName: generatedColumnNameFor('task', TaskAttr.rating.key),
        direction: 'desc',
      },
      {
        columnName: generatedColumnNameFor('task', TaskAttr.status.key),
        direction: 'asc',
      },
    ]);
    expect(composite?.unique).toBe(false);
    expect(composite?.wherePredicates).toEqual([]);
  });

  test('composite spec carries `unique` + `attributeIsNotNull` predicates verbatim', () => {
    const registry = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({
          entityType: 'task',
          attributes: TaskAttr,
          composite: [
            {
              name: 'rating-status-strict',
              unique: true,
              fields: [{ tag: TaskAttr.rating }, { tag: TaskAttr.status }],
              where: [{ kind: 'attributeIsNotNull', tag: TaskAttr.status }],
            },
          ],
        })
      )
      .freeze();
    const layout = computeDesiredPgLayout(registry);
    const table = layout.tables.get(partitionTableName('task'));
    const composite = table?.compositeIndexes.get(
      compositeIndexNameFor('task', 'rating-status-strict')
    );
    expect(composite?.unique).toBe(true);
    expect(composite?.wherePredicates).toEqual([
      { columnName: generatedColumnNameFor('task', TaskAttr.status.key) },
    ]);
  });

  test('composite referencing a non-indexed attribute crashes at compute time', () => {
    const registry = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({
          entityType: 'task',
          attributes: TaskAttr,
          composite: [
            {
              name: 'rating-title',
              fields: [{ tag: TaskAttr.rating }, { tag: TaskAttr.title }],
            },
          ],
        })
      )
      .freeze();
    expect(() => computeDesiredPgLayout(registry)).toThrow(
      /no generated column/i
    );
  });
});

describe('computeDesiredPgLayout: empty registry', () => {
  test('returns an empty layout', () => {
    const registry = createEntitySchemaRegistry().freeze();
    const layout = computeDesiredPgLayout(registry);
    expect(layout.tables.size).toBe(0);
  });
});
