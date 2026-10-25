import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type {
  BundledPuzzle,
  PuzzleContent,
} from '@pkgs/turn-game-shared-ts/puzzle-content';
import { replayPuzzleEvidence } from '@pkgs/turn-game-shared-ts/puzzle-content';

/**
 * Writing the starter content games ship: each puzzle published once, as an
 * immutable first edition by the platform's own author, and one pack of
 * them. Every puzzle is proven first — its witness must pass the game's
 * publication check against its exact definition — so nothing unproven is
 * ever published. Writing is idempotent and never changes what is already
 * there: a later release adds new puzzles under new ids instead of editing
 * an edition a pack or an attempt references.
 */
export const STARTER_CONTENT_OWNER = 'starter-content';

type StarterGame = {
  readonly id: string;
  readonly puzzleContent?: PuzzleContent | undefined;
};

export function starterDocumentId(gameId: string, id: string): string {
  return `starter:${gameId}:${id}`;
}

export function starterRevisionId(gameId: string, id: string): string {
  return `${starterDocumentId(gameId, id)}:1`;
}

/** What is wrong with a game's starter content; empty when every witness proves its puzzle. */
export function starterContentProblems(game: StarterGame): readonly string[] {
  const content = game.puzzleContent;
  const starter = content?.starter;
  if (content === undefined || starter === undefined) return [];
  return starter.puzzles.flatMap((puzzle) => {
    const replay = replayPuzzleEvidence(
      content.rules,
      puzzle.definition,
      puzzle.witness
    );
    const check = replay.valid
      ? content.validatePublication?.(puzzle.definition, replay.evidence)
      : replay;
    return replay.valid &&
      content.rules.complete(puzzle.definition, replay.evidence.state) &&
      check?.valid === true
      ? []
      : [
          `${game.id}/${puzzle.id}: ${check?.valid === false ? (check.issues[0]?.message ?? 'refused') : 'cannot be proven'}`,
        ];
  });
}

type Row = {
  readonly gameId: string;
  readonly id: string;
  readonly kind: 'puzzle' | 'pack';
  readonly rulesVersion: number;
  readonly body: Pick<
    BundledPuzzle,
    'title' | 'description' | 'difficulty' | 'definition'
  >;
};

async function publish(tx: SqlTx, row: Row, iso: string): Promise<void> {
  const document = starterDocumentId(row.gameId, row.id);
  const revision = starterRevisionId(row.gameId, row.id);
  const { title, description, difficulty, definition } = row.body;
  await tx.run(sql`INSERT INTO puzzle_content_documents
    (id, owner_id, game_id, kind, working_draft_id, published_revision_id, publication_count, status, created_at, updated_at, deleted_at)
    VALUES (${document}, ${STARTER_CONTENT_OWNER}, ${row.gameId}, ${row.kind}, ${null}, ${revision}, ${1}, ${'published'}, ${iso}, ${iso}, ${null})
    ON CONFLICT (id) DO NOTHING`);
  await tx.run(sql`INSERT INTO puzzle_content_revisions
    (id, document_id, owner_id, game_id, kind, edition, title, description, difficulty, definition, rules_version, created_at, updated_at, deleted_at)
    VALUES (${revision}, ${document}, ${STARTER_CONTENT_OWNER}, ${row.gameId}, ${row.kind}, ${1}, ${title}, ${description}, ${difficulty}, ${definition}, ${row.rulesVersion}, ${iso}, ${iso}, ${null})
    ON CONFLICT (id) DO NOTHING`);
  await tx.run(sql`INSERT INTO puzzle_content_publications
    (id, owner_id, game_id, kind, published_revision_id, publication_count, status, created_at, updated_at, deleted_at)
    VALUES (${document}, ${STARTER_CONTENT_OWNER}, ${row.gameId}, ${row.kind}, ${revision}, ${1}, ${'published'}, ${iso}, ${iso}, ${null})
    ON CONFLICT (id) DO NOTHING`);
}

async function publishPack(
  tx: SqlTx,
  game: StarterGame,
  iso: string
): Promise<void> {
  const starter = game.puzzleContent?.starter;
  if (starter === undefined) return;
  const items = starter.puzzles.map((puzzle) => ({
    puzzleId: starterDocumentId(game.id, puzzle.id),
    revisionId: starterRevisionId(game.id, puzzle.id),
  }));
  await publish(
    tx,
    {
      gameId: game.id,
      id: starter.id,
      kind: 'pack',
      rulesVersion: game.puzzleContent!.rulesVersion,
      body: {
        title: starter.title,
        description: starter.description,
        difficulty: '',
        definition: JSON.stringify({ items }),
      },
    },
    iso
  );
  const pack = starterRevisionId(game.id, starter.id);
  for (const [position, item] of items.entries())
    await tx.run(sql`INSERT INTO puzzle_content_pack_items
      (id, owner_id, pack_revision_id, puzzle_id, puzzle_revision_id, position, created_at, updated_at, deleted_at)
      VALUES (${`${pack}:${position}`}, ${STARTER_CONTENT_OWNER}, ${pack}, ${item.puzzleId}, ${item.revisionId}, ${position}, ${iso}, ${iso}, ${null})
      ON CONFLICT (id) DO NOTHING`);
}

/**
 * Publish every game's starter content that is not yet published. Throws,
 * writing nothing, when a witness fails to prove its puzzle.
 */
export async function seedStarterContent(
  tx: SqlTx,
  games: readonly StarterGame[],
  nowMs: number
): Promise<void> {
  const problems = games.flatMap(starterContentProblems);
  if (problems.length > 0)
    throw new Error(`starter content is not proven: ${problems.join('; ')}`);
  const iso = new Date(nowMs).toISOString();
  for (const game of games) {
    for (const puzzle of game.puzzleContent?.starter?.puzzles ?? [])
      await publish(
        tx,
        {
          gameId: game.id,
          id: puzzle.id,
          kind: 'puzzle',
          body: puzzle,
          rulesVersion: game.puzzleContent!.rulesVersion,
        },
        iso
      );
    await publishPack(tx, game, iso);
  }
}
