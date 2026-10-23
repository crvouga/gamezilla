import { CONTENT_TABLES } from '@libs/game-puzzle-shared-ts/content-tables';
import { createPuzzleContentMutation } from '@libs/game-puzzle-shared-ts/create-content-mutation';
import { publishPuzzleContentMutation } from '@libs/game-puzzle-shared-ts/publish-content-mutation';
import { openConformanceDb } from '@libs/permissions-shared-ts/world';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { MutationEnv } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { PuzzleContentCatalog } from '@pkgs/turn-game-shared-ts/puzzle-content-catalog';
import { createPuzzleContentCatalog } from '@pkgs/turn-game-shared-ts/puzzle-content-catalog';
import { pileContent } from './pile-game';

export const CONTENT_BODY = {
  title: 'River',
  description: 'A gentle beginning',
  difficulty: 'Gentle',
  definition: 'pile:3:white',
};

export type ContentFixture = {
  readonly db: SqlClient;
  readonly env: MutationEnv;
  readonly puzzleContents: PuzzleContentCatalog;
};

export async function createContentFixture(
  fixture: ContentFixture,
  args: {
    readonly id: string;
    readonly title: string;
    readonly kind?: 'puzzle' | 'pack';
    readonly definition?: string;
    readonly gameId?: string;
  }
): Promise<void> {
  await fixture.db.transaction((tx) =>
    createPuzzleContentMutation(fixture.puzzleContents).run(
      { tx, env: fixture.env },
      {
        documentId: args.id,
        draftId: `${args.id}-first`,
        gameId: args.gameId ?? 'pile',
        kind: args.kind ?? 'puzzle',
        body: {
          ...CONTENT_BODY,
          title: args.title,
          definition: args.definition ?? CONTENT_BODY.definition,
        },
      }
    )
  );
}

export async function publishContentFixture(
  fixture: ContentFixture,
  id: string
): Promise<void> {
  await fixture.db.transaction((tx) =>
    publishPuzzleContentMutation(fixture.puzzleContents).run(
      { tx, env: fixture.env },
      {
        documentId: id,
        draftId: `${id}-first`,
      }
    )
  );
}

export async function withContentFixture(
  run: (fixture: ContentFixture) => Promise<void>
): Promise<void> {
  const db = await openConformanceDb(CONTENT_TABLES);
  try {
    await run({
      db,
      puzzleContents: createPuzzleContentCatalog([
        { id: 'pile', puzzleContent: pileContent() },
        { id: 'other-pile', puzzleContent: pileContent('other-pile') },
      ]),
      env: {
        actorId: 'alice',
        deviceId: 'alice-phone',
        accountId: null,
        isAnon: true,
        now: () => new Date(0),
        createId: () => 'unused',
      },
    });
  } finally {
    await db.disconnect();
  }
}
