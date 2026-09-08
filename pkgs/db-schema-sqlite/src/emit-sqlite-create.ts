import { planClient } from '@pkgs/db-schema/core/plan';
import type { IntrospectedCatalog, Schema } from '@pkgs/db-schema/core/types';
import type { Sql } from '@pkgs/sql';
import { emitClientOperation } from './emit';

/**
 * Emit SQLite CREATE/INDEX DDL strings for a fresh schema (empty catalog).
 * For hosts that only accept SQL text (Bun WebView sql-host iframe), not for product migrate.
 */
export function emitSqliteCreateStatements(schema: Schema): readonly string[] {
  const emptyCatalog: IntrospectedCatalog = {
    tables: new Map(),
    indexes: [],
    allTableNames: new Set(),
  };
  const plan = planClient(schema._declared, emptyCatalog, {
    ownership: 'declared-only',
  });
  if (!plan.ok) {
    const detail = plan.drift.map((d) => `${d.path}: ${d.message}`).join('\n');
    throw new Error(`emitSqliteCreateStatements drift:\n${detail}`);
  }
  const out: string[] = [];
  for (const op of plan.operations) {
    for (const stmt of emitClientOperation(op, schema._declared)) {
      out.push(sqlToText(stmt));
    }
  }
  return out;
}

function sqlToText(stmt: Sql<unknown>): string {
  return stmt.sql;
}
