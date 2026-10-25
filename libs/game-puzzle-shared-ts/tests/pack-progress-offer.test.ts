import { expect, test } from 'bun:test';
import type { AttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import type { ContentAttempt } from '@libs/game-puzzle-shared-ts/attempt-types';
import type { ContentRevision } from '@libs/game-puzzle-shared-ts/content-types';
import { packProgress } from '@libs/game-puzzle-shared-ts/pack-progress';

const edition = (
  id: string,
  kind: 'puzzle' | 'pack',
  definition = ''
): ContentRevision => ({
  id,
  document_id: `${id}-doc`,
  owner_id: 'alice',
  game_id: 'pile',
  kind,
  edition: 1,
  title: id,
  description: '',
  difficulty: '',
  definition,
  rules_version: 1,
  deleted_at: null,
});

const attempt = (source: string, order: number): ContentAttempt => ({
  id: `attempt-${source}`,
  owner_id: 'bob',
  puzzle_id: `${source}-doc`,
  source_id: source,
  game_id: 'pile',
  mode: 'ordinary',
  pack_revision_id: 'pack',
  current_position_id: `position-${source}`,
  activity_order: order,
  rules_version: 1,
  deleted_at: null,
  updated_at: '2026-10-24T00:00:00.000Z',
});

// regression: pack-offer-skips-last-played-completed-puzzle
test('after the last puzzle played is completed, the first unfinished one is offered', () => {
  const items = ['first', 'second', 'third'].map((id) => ({
    puzzleId: `${id}-doc`,
    revisionId: id,
  }));
  const content = {
    documents: [],
    drafts: [],
    revisions: [
      edition('pack', 'pack', JSON.stringify({ items })),
      edition('first', 'puzzle'),
      edition('second', 'puzzle'),
      edition('third', 'puzzle'),
    ],
  };
  const play: AttemptLibrary = {
    attempts: [attempt('first', 1), attempt('third', 2), attempt('second', 3)],
    positions: [],
    completions: [
      {
        id: 'bob:second',
        owner_id: 'bob',
        puzzle_id: 'second-doc',
        puzzle_revision_id: 'second',
        attempt_id: 'attempt-second',
        position_id: 'position-second',
        statistics: '{}',
        deleted_at: null,
      },
    ],
  };
  expect(
    packProgress({ content, play, packRevisionId: 'pack' })?.next?.revisionId
  ).toBe('first');
});
