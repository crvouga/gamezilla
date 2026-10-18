import type { SqlFragment } from '@pkgs/sql-root-shared/sql';
import sql, { raw } from '@pkgs/sql-root-shared/sql';

/**
 * A puzzle's namespace: the share of the catalogue, the puzzle profiles
 * and the feed settings that belongs to one game. A game's namespace is
 * `'<id>/'`; the platform's durable game keeps the unprefixed `''`, so its
 * stored puzzle ids (Lichess ids, which never contain `/`) are unchanged.
 */

const NAMESPACE = /^(?:[a-z][a-z0-9-]{0,31}\/)?$/;

/** Whether `namespace` is `''` or a game's `'<id>/'`. */
export function isPuzzleNamespace(namespace: string): boolean {
  return NAMESPACE.test(namespace);
}

/**
 * The namespace a stored puzzle id is in: everything up to and including
 * its first `/`, or `''` when it has none.
 */
export function puzzleNamespaceOf(puzzleId: string): string {
  const slash = puzzleId.indexOf('/');
  return slash < 0 ? '' : puzzleId.slice(0, slash + 1);
}

/** Whether the stored puzzle `puzzleId` is in `namespace`. */
export function inPuzzleNamespace(
  puzzleId: string,
  namespace: string
): boolean {
  return puzzleNamespaceOf(puzzleId) === namespace;
}

/**
 * The key of a person's puzzle profile and feed settings in `namespace`:
 * the person's id itself in the durable namespace, as every stored row
 * already is.
 */
export function puzzleOwnerKey(namespace: string, ownerId: string): string {
  return `${namespace}${ownerId}`;
}

/**
 * The SQL condition that `column` (a puzzle id) is in `namespace`, alike in
 * SQLite and Postgres: no `/` at all for the durable namespace, otherwise
 * the namespace as a prefix. A namespace is lowercase letters, digits and
 * `-` before its `/`, so it holds no `LIKE` wildcard, and ids outside it
 * never enter the catalogue (`admitCataloguePuzzle`). Every reader filters
 * rows a rating index has already narrowed, so it needs no index of its own.
 */
export function puzzleNamespaceCondition(
  namespace: string,
  column = 'id'
): SqlFragment {
  if (!isPuzzleNamespace(namespace))
    throw new Error(`"${namespace}" is not a puzzle namespace`);
  return namespace === ''
    ? sql<void>`${raw(column)} NOT LIKE '%/%'`
    : sql<void>`${raw(column)} LIKE ${`${namespace}%`}`;
}
