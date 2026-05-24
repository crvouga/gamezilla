import { assert } from '@pkgs/assert';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createEntitySchemaRegistry, defineEntitySchema } from '../schema';
import { QTask, QItem } from '../test/query-test-attrs';
import {
  buildPartitionInfo,
  buildPartitionLayout,
  computeGeneratedColumns,
  EMPTY_PARTITION_LAYOUT,
  entityTypeSlug,
  isIndexableDataType,
  partitionTableName,
  PATCH_DB_GENERATED_COLUMN_PREFIX,
  PATCH_DB_PARTITION_PREFIX,
  pgColumnTypeFor,
} from './partitioning';

function registerThrowingCrashHandlerForTests(): () => void {
  return assert.registerCrashHandler({
    priority: 5,
    match: () => true,
    crash(message, context) {
      const err = new Error(message);
      Object.assign(err, { context });
      throw err;
    },
  });
}

let dispose: () => void;
beforeAll(() => {
  dispose = registerThrowingCrashHandlerForTests();
});
afterAll(() => {
  dispose();
});

describe('partitioning: pure helpers', () => {
  test('entityTypeSlug replaces dots and dashes with underscores', () => {
    expect(entityTypeSlug('chess.puzzle')).toBe('chess_puzzle');
    expect(entityTypeSlug('chess.puzzle.interaction')).toBe(
      'chess_puzzle_interaction'
    );
    expect(entityTypeSlug('todo-list')).toBe('todo_list');
  });

  test('partitionTableName composes the snapshots prefix', () => {
    expect(partitionTableName('chess.puzzle')).toBe(
      `${PATCH_DB_PARTITION_PREFIX}chess_puzzle`
    );
  });

  test('isIndexableDataType permits scalars, rejects bag types', () => {
    expect(isIndexableDataType('text')).toBe(true);
    expect(isIndexableDataType('integer')).toBe(true);
    expect(isIndexableDataType('boolean')).toBe(true);
    expect(isIndexableDataType('timestamp')).toBe(true);
    expect(isIndexableDataType('array')).toBe(false);
    expect(isIndexableDataType('json')).toBe(false);
    expect(isIndexableDataType('binary')).toBe(false);
  });

  test('pgColumnTypeFor maps numeric data types to numeric, booleans to boolean, rest to text', () => {
    expect(pgColumnTypeFor('integer')).toBe('numeric');
    expect(pgColumnTypeFor('number')).toBe('numeric');
    expect(pgColumnTypeFor('bigint')).toBe('numeric');
    expect(pgColumnTypeFor('boolean')).toBe('boolean');
    expect(pgColumnTypeFor('text')).toBe('text');
    expect(pgColumnTypeFor('uuid')).toBe('text');
    expect(pgColumnTypeFor('enum')).toBe('text');
    expect(pgColumnTypeFor('timestamp')).toBe('text');
  });
});

describe('computeGeneratedColumns', () => {
  test('produces one column per indexed attribute with stable name + dataType', () => {
    const schema = defineEntitySchema({
      entityType: 'task',
      attributes: {
        score: QTask.score.indexed({ sortable: true }),
        status: QTask.status.indexed(),
        title: QTask.title,
      },
    });
    const cols = computeGeneratedColumns(schema);
    const byName = new Map(cols.map((c) => [c.columnName, c]));
    expect(byName.size).toBe(2);
    const score = byName.get(`${PATCH_DB_GENERATED_COLUMN_PREFIX}task__score`);
    expect(score?.attribute).toBe(QTask.score.key);
    expect(score?.dataType).toBe('number');
    const status = byName.get(`${PATCH_DB_GENERATED_COLUMN_PREFIX}task__status`);
    expect(status?.attribute).toBe(QTask.status.key);
    expect(status?.dataType).toBe('text');
  });

  test('non-indexed attributes are not promoted to generated columns', () => {
    const schema = defineEntitySchema({
      entityType: 'task',
      attributes: {
        title: QTask.title,
      },
    });
    const cols = computeGeneratedColumns(schema);
    expect(cols.length).toBe(0);
  });

  test('column slugs are namespaced by entity type so cross-entity attrs do not collide', () => {
    const taskSchema = defineEntitySchema({
      entityType: 'task',
      attributes: {
        score: QTask.score.indexed(),
      },
    });
    const itemSchema = defineEntitySchema({
      entityType: 'item',
      attributes: {
        score: QItem.score.indexed(),
      },
    });
    const taskCols = computeGeneratedColumns(taskSchema);
    const itemCols = computeGeneratedColumns(itemSchema);
    // The same local segment (`score`) lands on different column names,
    // because Postgres requires generated columns to live on the
    // partitioned parent and propagate to every partition — the names
    // must not collide across entity types.
    expect(taskCols[0]?.columnName).not.toBe(itemCols[0]?.columnName);
    expect(taskCols[0]?.columnName).toBe(
      `${PATCH_DB_GENERATED_COLUMN_PREFIX}task__score`
    );
    expect(itemCols[0]?.columnName).toBe(
      `${PATCH_DB_GENERATED_COLUMN_PREFIX}item__score`
    );
    expect(partitionTableName(taskSchema.entityType)).not.toBe(
      partitionTableName(itemSchema.entityType)
    );
  });
});

describe('buildPartitionLayout / buildPartitionInfo', () => {
  test('layout exposes one info per registered schema; non-registered returns null', () => {
    const registry = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({
          entityType: 'task',
          attributes: {
            score: QTask.score.indexed({ sortable: true }),
          },
        })
      )
      .freeze();
    const layout = buildPartitionLayout(registry);
    const info = layout.get('task');
    expect(info?.entityType).toBe('task');
    expect(info?.tableName).toBe('snapshots__task');
    expect(info?.columnsByAttribute.size).toBe(1);
    expect(layout.get('item')).toBe(null);
  });

  test('EMPTY_PARTITION_LAYOUT.get always returns null', () => {
    expect(EMPTY_PARTITION_LAYOUT.get('anything')).toBe(null);
    expect([...EMPTY_PARTITION_LAYOUT.values()].length).toBe(0);
  });

  test('buildPartitionInfo populates columnsByAttribute keyed by attribute key', () => {
    const schema = defineEntitySchema({
      entityType: 'task',
      attributes: {
        score: QTask.score.indexed(),
      },
    });
    const info = buildPartitionInfo(schema);
    const col = info.columnsByAttribute.get(QTask.score.key);
    expect(col?.columnName).toBe(`${PATCH_DB_GENERATED_COLUMN_PREFIX}task__score`);
  });
});
