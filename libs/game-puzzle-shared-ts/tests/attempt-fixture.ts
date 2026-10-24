import { readContentAttempt } from '@libs/game-puzzle-shared-ts/attempt-store';
import { changePuzzleAttemptMutation } from '@libs/game-puzzle-shared-ts/change-attempt-mutation';
import { startPuzzlePlaytestMutation } from '@libs/game-puzzle-shared-ts/start-playtest-mutation';
import { type ContentFixture, createContentFixture } from './content-fixture';

export const FIRST_MOVE = {
  attemptId: 'attempt',
  parentId: 'start',
  positionId: 'one',
  command: { kind: 'play' as const, action: 'take1' },
};

export async function arrangeAttempt(f: ContentFixture): Promise<void> {
  await createContentFixture(f, { id: 'river', title: 'River' });
  await f.db.transaction((tx) =>
    startPuzzlePlaytestMutation(f.puzzleContents).run(
      { tx, env: f.env },
      {
        documentId: 'river',
        draftId: 'river-first',
        attemptId: 'attempt',
        positionId: 'start',
      }
    )
  );
}

export function replayFirstMove(f: ContentFixture): Promise<void> {
  return f.db.transaction((tx) =>
    changePuzzleAttemptMutation(f.puzzleContents).run(
      { tx, env: f.env },
      FIRST_MOVE
    )
  );
}

export async function fixtureAttempt(f: ContentFixture) {
  const attempt = await readContentAttempt(f.db, 'attempt');
  if (attempt === null) throw new Error('The fixture attempt is missing');
  return attempt;
}
