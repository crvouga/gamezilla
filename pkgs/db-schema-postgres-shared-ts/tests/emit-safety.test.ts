import { describe, expect, test } from 'bun:test';
import {
  emitServerOperation,
  FORBIDDEN_SERVER_DDL,
} from '@pkgs/db-schema-postgres-shared-ts/emit';
import {
  asSchemaIdent,
  fingerprintForIndexDef,
} from '@pkgs/db-schema-root-shared-ts/index-fingerprint';
import type { ServerOperation } from '@pkgs/db-schema-root-shared-ts/operations';
import { SERVER_OPERATION_KINDS } from '@pkgs/db-schema-root-shared-ts/operations';

const operations: readonly ServerOperation[] = [
  {
    kind: 'create_table',
    table: asSchemaIdent('notes'),
    columns: [
      { name: asSchemaIdent('id'), type: 'uuid', isPrimaryKey: true },
      { name: asSchemaIdent('body'), type: 'text', isPrimaryKey: false },
      {
        name: asSchemaIdent('rating'),
        type: 'integer',
        isPrimaryKey: false,
        physicalPostgres: 'int4',
      },
    ],
  },
  {
    kind: 'add_column',
    table: asSchemaIdent('notes'),
    column: asSchemaIdent('detail'),
    type: 'text',
  },
  {
    kind: 'add_column',
    table: asSchemaIdent('notes'),
    column: asSchemaIdent('score'),
    type: 'numeric',
    physicalPostgres: 'numeric',
  },
  {
    kind: 'backfill',
    table: asSchemaIdent('notes'),
    column: asSchemaIdent('detail'),
    expression: `coalesce("body", '')`,
  },
  {
    kind: 'create_index',
    name: fingerprintForIndexDef(['notes', 'body'], false),
    table: asSchemaIdent('notes'),
    columns: [asSchemaIdent('body')],
    unique: false,
  },
  {
    kind: 'create_index',
    name: fingerprintForIndexDef(['notes', 'detail'], true),
    table: asSchemaIdent('notes'),
    columns: [asSchemaIdent('detail')],
    unique: true,
  },
  {
    kind: 'drop_index',
    name: fingerprintForIndexDef(['notes', 'legacy'], false),
  },
  {
    kind: 'drop_not_null',
    table: asSchemaIdent('notes'),
    column: asSchemaIdent('body'),
  },
  {
    kind: 'widen_integer',
    table: asSchemaIdent('notes'),
    column: asSchemaIdent('rating'),
  },
  {
    kind: 'drop_default',
    table: asSchemaIdent('notes'),
    column: asSchemaIdent('created_at'),
  },
];

describe('postgres server emit safety', () => {
  test('covers every ServerOperation variant', () => {
    const kinds = [...new Set(operations.map((op) => op.kind))].sort();
    expect(kinds).toEqual([...SERVER_OPERATION_KINDS].sort());
  });

  test('never emits forbidden destructive DDL (concurrent and plain)', () => {
    for (const op of operations) {
      expect(emitServerOperation(op).sql).not.toMatch(FORBIDDEN_SERVER_DDL);
      expect(emitServerOperation(op, { concurrently: false }).sql).not.toMatch(
        FORBIDDEN_SERVER_DDL
      );
    }
  });

  test('index DDL switches CONCURRENTLY with the form', () => {
    const create = operations.find((op) => op.kind === 'create_index');
    const drop = operations.find((op) => op.kind === 'drop_index');
    expect(create).toBeDefined();
    expect(drop).toBeDefined();
    if (create === undefined || drop === undefined) return;

    expect(emitServerOperation(create).sql).toMatch(
      /CREATE (UNIQUE )?INDEX CONCURRENTLY/i
    );
    expect(
      emitServerOperation(create, { concurrently: false }).sql
    ).not.toMatch(/CONCURRENTLY/i);
    expect(emitServerOperation(drop).sql).toMatch(/DROP INDEX CONCURRENTLY/i);
    expect(emitServerOperation(drop, { concurrently: false }).sql).not.toMatch(
      /CONCURRENTLY/i
    );
  });
});
