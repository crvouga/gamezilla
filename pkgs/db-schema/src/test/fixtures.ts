import { defineSchema } from '../core/define-schema';
import {
  asValidatedIdent,
  fingerprintForIndexDef,
} from '../core/index-fingerprint';
import type {
  ColumnType,
  IntrospectedCatalog,
  IntrospectedTable,
} from '../core/types';

export const sampleSchema = defineSchema({
  tables: {
    users: {
      email: 'text',
      display_name: 'text',
      name: 'text',
    },
    todos: {
      user_id: 'uuid',
      title: 'text',
      done: 'boolean',
      status: 'text',
      due_at: 'timestamp',
    },
    legacy_notes: {
      body: 'text',
    },
  },
  indexes: [
    ['todos', 'user_id'],
    ['todos', 'due_at'],
    ['todos', 'created_at'],
  ],
  deprecations: [
    ['legacy_notes', 'replaced by todos'],
    ['users', 'name', 'use display_name'],
  ],
});

export function emptyCatalog(): IntrospectedCatalog {
  return {
    tables: new Map(),
    indexes: [],
    allTableNames: new Set(),
  };
}

export function tableWithColumns(
  name: string,
  columns: {
    name: string;
    type: ColumnType | string;
    nullable?: boolean;
    isPrimaryKey?: boolean;
  }[]
): IntrospectedTable {
  return {
    name,
    columns: columns.map((c) => ({
      name: c.name,
      type: c.type,
      nullable: c.nullable ?? c.name !== 'id',
      isPrimaryKey: c.isPrimaryKey ?? c.name === 'id',
    })),
  };
}

export function fullTodosTable(
  extras: { name: string; type: string; nullable?: boolean }[] = []
): IntrospectedTable {
  return tableWithColumns('todos', [
    { name: 'id', type: 'text', nullable: false, isPrimaryKey: true },
    { name: 'created_at', type: 'timestamp' },
    { name: 'updated_at', type: 'timestamp' },
    { name: 'deleted_at', type: 'timestamp' },
    { name: 'user_id', type: 'uuid' },
    { name: 'title', type: 'text' },
    { name: 'done', type: 'boolean' },
    { name: 'status', type: 'text' },
    { name: 'due_at', type: 'timestamp' },
    ...extras,
  ]);
}

export { asValidatedIdent, fingerprintForIndexDef };
