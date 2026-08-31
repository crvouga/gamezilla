import { defineTable } from '../../core/define-table';
import { registerTables } from '../../core/register-tables';
import type { Schema } from '../../core/types';

export type SchemaVersion = 0 | 1 | 2 | 3 | 4;

export const MAX_SCHEMA_VERSION = 4;

function v0(): Schema {
  return registerTables([
    defineTable({ domain: 'items', name: 'items', columns: { title: 'text' } }),
  ]);
}

function v1(): Schema {
  return registerTables([
    defineTable({
      domain: 'items',
      name: 'items',
      columns: { title: 'text', body: 'text' },
      indexes: ['title'],
    }),
  ]);
}

function v2(): Schema {
  return registerTables([
    defineTable({
      domain: 'items',
      name: 'items',
      columns: {
        body: 'text',
        display_title: { type: 'text', renamedFrom: 'title' },
      },
      deprecations: [['title', 'renamed to display_title']],
      indexes: ['body'],
    }),
  ]);
}

function v3(): Schema {
  return registerTables([
    defineTable({
      domain: 'items',
      name: 'items',
      columns: {
        body: 'text',
        display_title: 'text',
        label: { type: 'text', backfill: { from: 'display_title' } },
      },
      deprecations: [['title', 'renamed to display_title']],
      indexes: ['body'],
    }),
  ]);
}

function v4(): Schema {
  return registerTables([
    defineTable({
      domain: 'items',
      name: 'items',
      columns: {
        body: 'text',
        display_title: 'text',
        label: 'text',
        score: 'integer',
      },
      deprecations: [['title', 'renamed to display_title']],
      indexes: ['body', 'score'],
    }),
  ]);
}

/** Compatible expand/contract chain for DST. */
export function schemaAt(version: SchemaVersion): Schema {
  if (version === 0) return v0();
  if (version === 1) return v1();
  if (version === 2) return v2();
  if (version === 3) return v3();
  return v4();
}

export function liveColumns(version: SchemaVersion): readonly string[] {
  const table = schemaAt(version).snapshot().tables['items']!;
  return Object.keys(table).sort();
}

/** Forbidden schema: type change in place — must refuse on the server. */
export function forbiddenSchema(): Schema {
  return registerTables([
    defineTable({
      domain: 'items',
      name: 'items',
      columns: { title: 'integer' },
    }),
  ]);
}
