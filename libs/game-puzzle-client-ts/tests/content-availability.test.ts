import { expect, test } from 'bun:test';
import { contentEditionAvailable } from '@libs/game-puzzle-client-ts/content-availability';
import type { ContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';

test('a selected pack edition stays startable after a later edition becomes current', () => {
  // regression: puzzle-old-pack-disabled-after-republish
  const library: ContentLibrary = {
    documents: [
      {
        id: 'river-pack',
        owner_id: 'alice',
        game_id: 'counting',
        kind: 'pack',
        working_draft_id: 'pack-draft-three',
        published_revision_id: 'pack-edition-two',
        publication_count: 2,
        status: 'published',
        deleted_at: null,
      },
    ],
    drafts: [],
    revisions: [
      {
        id: 'pack-edition-one',
        document_id: 'river-pack',
        owner_id: 'alice',
        game_id: 'counting',
        kind: 'pack',
        edition: 1,
        title: 'River pack',
        description: '',
        difficulty: '',
        definition:
          '{"items":[{"puzzleId":"river","revisionId":"river-edition-one"}]}',
        rules_version: 1,
        deleted_at: null,
      },
    ],
  };
  expect(
    contentEditionAvailable(library, 'river-edition-one', 'pack-edition-one')
  ).toBe(true);
  expect(
    contentEditionAvailable(
      {
        ...library,
        documents: library.documents.map((doc) => ({
          ...doc,
          status: 'withdrawn' as const,
        })),
      },
      'river-edition-one',
      'pack-edition-one'
    )
  ).toBe(false);
  expect(
    contentEditionAvailable(library, 'river-edition-one', 'unknown-pack')
  ).toBe(false);
});
