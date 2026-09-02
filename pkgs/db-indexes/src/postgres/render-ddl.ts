import { assert } from '@pkgs/assert';
import { isOwnedName } from '../core/naming';
import type { IndexDefinition } from '../core/types';

/** Same heuristic as `@pkgs/db-schema` postgres emit — Neon pooler wraps in BEGIN. */
export function isConcurrentlyUnsupportedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /concurrently/i.test(message);
}

export function renderCreateIndexSql(
  def: IndexDefinition,
  name: string,
  concurrently = true
): string {
  assert.ok(isOwnedName(name), 'render: owned name');
  const cols = def.columns
    .map((c) => `"${c.name}" ${c.order.toUpperCase()}`)
    .join(', ');
  const include =
    def.include.length > 0
      ? ` INCLUDE (${def.include.map((c) => `"${c}"`).join(', ')})`
      : '';
  const pred = def.predicate != null ? ` WHERE ${def.predicate}` : '';
  const concurrentKw = concurrently ? 'CONCURRENTLY ' : '';
  return `CREATE INDEX ${concurrentKw}IF NOT EXISTS "${name}" ON "${def.table}" (${cols})${include}${pred}`;
}

export function renderDropIndexSql(name: string, concurrently = true): string {
  assert.ok(isOwnedName(name), 'render drop: owned name');
  const concurrentKw = concurrently ? 'CONCURRENTLY ' : '';
  return `DROP INDEX ${concurrentKw}IF EXISTS "${name}"`;
}
