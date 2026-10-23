import { assertPuzzleContent, type PuzzleContent } from './puzzle-content';

export type PuzzleContentCatalog = {
  readonly byId: (id: string) => PuzzleContent | undefined;
};

/** Derived from the normal game registrations, never a second game registry. */
export function createPuzzleContentCatalog(
  games: readonly {
    readonly id: string;
    readonly puzzleContent?: PuzzleContent;
  }[]
): PuzzleContentCatalog {
  const content = new Map<string, PuzzleContent>();
  for (const game of games) {
    if (game.puzzleContent === undefined) continue;
    if (content.has(game.id))
      throw new Error(`Duplicate puzzle content game: ${game.id}`);
    assertPuzzleContent(game.id, game.puzzleContent);
    content.set(game.id, game.puzzleContent);
  }
  return { byId: (id) => content.get(id) };
}
