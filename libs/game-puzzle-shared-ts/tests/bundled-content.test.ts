import { expect, test } from 'bun:test';
import { readAttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import {
  BUNDLED_OWNER_ID,
  bundledContent,
  withBundledContent,
} from '@libs/game-puzzle-shared-ts/bundled-content';
import { changePuzzleAttemptMutation } from '@libs/game-puzzle-shared-ts/change-attempt-mutation';
import { discoverContent } from '@libs/game-puzzle-shared-ts/content-library';
import { packProgress } from '@libs/game-puzzle-shared-ts/pack-progress';
import { startPuzzleAttemptMutation as start } from '@libs/game-puzzle-shared-ts/start-attempt-mutation';
import {
  assertPuzzleContent,
  type PuzzleContent,
} from '@pkgs/turn-game-shared-ts/puzzle-content';
import { createPuzzleContentCatalog } from '@pkgs/turn-game-shared-ts/puzzle-content-catalog';
import { type ContentFixture, withContentFixture } from './content-fixture';
import { pileContent } from './pile-game';

const shipped = (definition = 'pile:2:white'): PuzzleContent => ({
  ...pileContent(),
  bundledPacks: [
    {
      id: 'starter',
      title: 'First piles',
      description: 'Take the last stones.',
      puzzles: [
        {
          id: 'starter-1',
          title: 'Two stones',
          description: '',
          difficulty: 'Gentle',
          definition,
          witness: ['take2'],
        },
        {
          id: 'starter-2',
          title: 'Three stones',
          description: '',
          difficulty: 'Gentle',
          definition: 'pile:3:white',
          witness: ['take1', 'take2'],
        },
      ],
    },
  ],
});

function withShipped(run: (f: ContentFixture) => Promise<void>) {
  return withContentFixture((fixture) =>
    run({
      ...fixture,
      puzzleContents: createPuzzleContentCatalog([
        { id: 'pile', puzzleContent: shipped() },
      ]),
    })
  );
}

const editions = bundledContent('pile', shipped());
const pack = editions.revisions.find((edition) => edition.kind === 'pack');
const first = editions.revisions.find(
  (edition) => edition.title === 'Two stones'
);

test('a game ships published editions in one ordered pack, owned by no person', () => {
  expect(pack).toBeDefined();
  expect(editions.documents.every((doc) => doc.status === 'published')).toBe(
    true
  );
  expect(new Set(editions.documents.map((doc) => doc.owner_id))).toEqual(
    new Set([BUNDLED_OWNER_ID])
  );
  const library = withBundledContent(
    { documents: [], drafts: [], revisions: [] },
    'pile',
    shipped()
  );
  expect(discoverContent(library, 'pile').map((entry) => entry.title)).toEqual([
    'First piles',
    'Two stones',
    'Three stones',
  ]);
});

test('changing a shipped puzzle gives it another edition identity', () => {
  const changed = bundledContent('pile', shipped('pile:4:white'));
  expect(changed.revisions.map((entry) => entry.id)).not.toContain(first?.id);
  expect(changed.documents.map((doc) => doc.id)).toEqual(
    editions.documents.map((doc) => doc.id)
  );
});

test('registration refuses a shipped puzzle whose witness does not complete it', () => {
  expect(() => assertPuzzleContent('pile', shipped())).not.toThrow();
  expect(() => assertPuzzleContent('pile', shipped('pile:3:white'))).toThrow(
    'needs a witness that completes it'
  );
});

test('a shipped pack puzzle starts, completes and counts toward pack progress', async () => {
  await withShipped(async (f) => {
    if (pack === undefined || first === undefined)
      throw new Error('missing shipped editions');
    await f.db.transaction((tx) =>
      start(f.puzzleContents).run(
        { tx, env: f.env },
        {
          attemptId: 'attempt',
          positionId: 'start',
          revisionId: first.id,
          packRevisionId: pack.id,
        }
      )
    );
    await f.db.transaction((tx) =>
      changePuzzleAttemptMutation(f.puzzleContents).run(
        { tx, env: f.env },
        {
          attemptId: 'attempt',
          parentId: 'start',
          positionId: 'done',
          command: { kind: 'play', action: 'take2' },
        }
      )
    );
    const play = await readAttemptLibrary(f.db);
    expect(play.completions.map((entry) => entry.puzzle_revision_id)).toEqual([
      first.id,
    ]);
    const progress = packProgress({
      content: withBundledContent(
        { documents: [], drafts: [], revisions: [] },
        'pile',
        shipped()
      ),
      play,
      packRevisionId: pack.id,
    });
    expect(progress?.completedCount).toBe(1);
    expect(progress?.next?.title).toBe('Three stones');
  });
});

test('a shipped puzzle is not started inside a pack that does not hold it', async () => {
  await withShipped(async (f) => {
    if (first === undefined) throw new Error('missing shipped editions');
    await expect(
      f.db.transaction((tx) =>
        start(f.puzzleContents).run(
          { tx, env: f.env },
          {
            attemptId: 'attempt',
            positionId: 'start',
            revisionId: first.id,
            packRevisionId: first.id,
          }
        )
      )
    ).rejects.toMatchObject({ code: 'PUZZLE_UNAVAILABLE' });
    await expect(
      f.db.transaction((tx) =>
        start(f.puzzleContents).run(
          { tx, env: f.env },
          {
            attemptId: 'other',
            positionId: 'other-start',
            revisionId: 'bundled:pile:starter-9:00000000',
            packRevisionId: null,
          }
        )
      )
    ).rejects.toMatchObject({ code: 'PUZZLE_UNAVAILABLE' });
  });
});
