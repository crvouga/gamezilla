import type {
  BundledPuzzle,
  BundledPuzzlePack,
  PuzzleContent,
} from '@pkgs/turn-game-shared-ts/puzzle-content';
import type { PuzzleContentCatalog } from '@pkgs/turn-game-shared-ts/puzzle-content-catalog';
import type { ContentLibrary } from './content-library';
import type { ContentDocument, ContentRevision } from './content-types';

/** Editions a game ships are published by no person. */
export const BUNDLED_OWNER_ID = 'bundled';
const PREFIX = 'bundled:';

/** FNV-1a: any change to a shipped edition gives it another identity. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

type Shipped = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly difficulty: string;
  readonly definition: string;
};

function editionOf(
  gameId: string,
  game: PuzzleContent,
  kind: 'puzzle' | 'pack',
  shipped: Shipped
): { document: ContentDocument; revision: ContentRevision } {
  const documentId = `${PREFIX}${gameId}:${shipped.id}`;
  const revisionId = `${documentId}:${fingerprint(
    JSON.stringify([shipped, game.rulesVersion])
  )}`;
  return {
    document: {
      id: documentId,
      owner_id: BUNDLED_OWNER_ID,
      game_id: gameId,
      kind,
      working_draft_id: null,
      published_revision_id: revisionId,
      publication_count: 1,
      status: 'published',
      deleted_at: null,
    },
    revision: {
      id: revisionId,
      document_id: documentId,
      owner_id: BUNDLED_OWNER_ID,
      game_id: gameId,
      kind,
      edition: 1,
      title: shipped.title,
      description: shipped.description,
      difficulty: shipped.difficulty,
      definition: shipped.definition,
      rules_version: game.rulesVersion,
      deleted_at: null,
    },
  };
}

function packEditions(
  gameId: string,
  game: PuzzleContent,
  pack: BundledPuzzlePack
) {
  const puzzles = pack.puzzles.map((puzzle: BundledPuzzle) =>
    editionOf(gameId, game, 'puzzle', puzzle)
  );
  const definition = JSON.stringify({
    items: puzzles.map((entry) => ({
      puzzleId: entry.document.id,
      revisionId: entry.revision.id,
    })),
  });
  return [
    editionOf(gameId, game, 'pack', {
      ...pack,
      difficulty: '',
      definition,
    }),
    ...puzzles,
  ];
}

/** The game's shipped editions as published content rows, available offline. */
export function bundledContent(
  gameId: string,
  game: PuzzleContent
): Pick<ContentLibrary, 'documents' | 'revisions'> {
  const editions = (game.bundledPacks ?? []).flatMap((pack) =>
    packEditions(gameId, game, pack)
  );
  return {
    documents: editions.map((entry) => entry.document),
    revisions: editions.map((entry) => entry.revision),
  };
}

export function isBundledContent(id: string): boolean {
  return id.startsWith(PREFIX);
}

/** Resolves a shipped edition or document by identity, for mutation replay. */
export function findBundledContent(
  catalog: PuzzleContentCatalog,
  id: string
): Pick<ContentLibrary, 'documents' | 'revisions'> | null {
  if (!isBundledContent(id)) return null;
  const gameId = id.slice(PREFIX.length).split(':')[0] ?? '';
  const game = catalog.byId(gameId);
  return game === undefined ? null : bundledContent(gameId, game);
}

export function withBundledContent(
  library: ContentLibrary,
  gameId: string,
  game: PuzzleContent
): ContentLibrary {
  const shipped = bundledContent(gameId, game);
  return {
    ...library,
    documents: [...shipped.documents, ...library.documents],
    revisions: [...shipped.revisions, ...library.revisions],
  };
}
