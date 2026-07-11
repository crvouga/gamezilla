import type { RowChange } from './row-change';
import { fail, ok, type WriteResult } from './write-result';
import type { WriteContext } from './write-context';
import type { WriteStore } from './write-store';

export function readRowString(
  row: RowChange,
  column: string
): string | undefined {
  const raw = row.values?.[column];
  return typeof raw === 'string' ? raw : undefined;
}

export function readRowStringArray(
  row: RowChange,
  column: string
): readonly string[] {
  const raw = row.values?.[column];
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string');
}

export function requireSignedIn(
  ctx: WriteContext,
  code: string
): WriteResult<void> | null {
  if (ctx.accountId === null) {
    return fail(code, 'sign-in required');
  }
  return null;
}

export function ownerMatches(
  owner: string | undefined,
  myId: string,
  code: string
): WriteResult<void> | null {
  if (owner !== undefined && owner !== myId) {
    return fail(code, 'owner mismatch');
  }
  return null;
}

export function idMatches(
  id: string,
  expected: string,
  code: string
): WriteResult<void> | null {
  if (id !== expected) {
    return fail(code, 'id mismatch');
  }
  return null;
}

export async function readOne<T>(
  store: WriteStore,
  sql: string,
  params: readonly unknown[],
  code: string
): Promise<WriteResult<T>> {
  const rows = await store.query<T>(sql, params);
  const row = rows[0];
  if (row === undefined) {
    return fail(code, 'row not found');
  }
  return ok(row);
}
