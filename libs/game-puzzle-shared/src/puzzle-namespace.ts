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
