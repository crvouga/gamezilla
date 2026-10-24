import { expect, test } from 'bun:test';
import { puzzleContentEditions } from '@libs/game-puzzle-shared-ts/content-detail-queries';
import { puzzleContentDocumentsById } from '@libs/game-puzzle-shared-ts/content-document-query';
import { puzzleContentPublished } from '@libs/game-puzzle-shared-ts/content-queries';
import {
  CONTENT_TOPIC_MAP,
  puzzleContentTopic,
} from '@libs/game-puzzle-shared-ts/content-topic-map';
import { publishPuzzleContentMutation } from '@libs/game-puzzle-shared-ts/publish-content-mutation';
import { savePuzzleContentDraftMutation } from '@libs/game-puzzle-shared-ts/save-content-draft-mutation';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import {
  topicMapCtxFromEnv,
  topicsFromWriteCapture,
} from '@pkgs/sync-engine-shared-ts/topic-map';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';
import { wrapMutationDb } from '@pkgs/sync-engine-shared-ts/wrap-mutation-db';
import {
  CONTENT_BODY,
  type ContentFixture,
  createContentFixture,
  publishContentFixture,
  withContentFixture,
} from './content-fixture';

async function publicSnapshot(
  fixture: ContentFixture,
  scope: 'discovery' | 'edition' | 'pack picker'
) {
  const ctx = {
    db: {
      query: (query: Sql<unknown>) => fixture.db.query(query as Sql<QueryRow>),
    },
    env: { ...fixture.env, actorId: 'bob', deviceId: 'bob-phone' },
  };
  if (scope === 'discovery')
    return puzzleContentPublished.run(ctx, { gameId: 'pile', afterId: '' });
  if (scope === 'edition')
    return puzzleContentEditions.run(ctx, { ids: ['river-first'] });
  return puzzleContentDocumentsById.run(ctx, { ids: ['river'] });
}

// regression: private-puzzle-draft-head-in-public-snapshot
test.each(['discovery', 'edition', 'pack picker'] as const)(
  'private working copies do not change the %s wire projection',
  async (scope) => {
    await withContentFixture(async (fixture) => {
      await createContentFixture(fixture, { id: 'river', title: 'River' });
      await publishContentFixture(fixture, 'river');
      const before = await publicSnapshot(fixture, scope);
      await fixture.db.transaction((tx) =>
        savePuzzleContentDraftMutation.run(
          { tx, env: { ...fixture.env, now: () => new Date(1_000) } },
          {
            documentId: 'river',
            parentId: 'river-first',
            draftId: 'private-river-next',
            body: { ...CONTENT_BODY, title: 'Private river plan' },
          }
        )
      );
      const after = await publicSnapshot(fixture, scope);
      expect(after).toEqual(before);
      expect(after['puzzle_content_publications']).toHaveLength(1);
      expect(JSON.stringify(after)).not.toContain('working_draft_id');
      expect(JSON.stringify(after)).not.toContain('private-river-next');
    });
  }
);

test('editing published content wakes its author, while publication wakes discovery', async () => {
  // regression: private-puzzle-draft-head-in-public-snapshot
  await withContentFixture(async (fixture) => {
    await createContentFixture(fixture, { id: 'river', title: 'River' });
    await publishContentFixture(fixture, 'river');
    const saved = await fixture.db.transaction(async (tx) => {
      const wrapped = wrapMutationDb(tx, fixture.env);
      await savePuzzleContentDraftMutation.run(
        { tx: wrapped.tx, env: fixture.env },
        {
          documentId: 'river',
          parentId: 'river-first',
          draftId: 'private-river-next',
          body: { ...CONTENT_BODY, title: 'Private river plan' },
        }
      );
      return wrapped.getCapture();
    });
    const topics = await topicsFromWriteCapture({
      topicMap: CONTENT_TOPIC_MAP,
      capture: saved,
      ctx: topicMapCtxFromEnv(fixture.env),
    });
    expect(topics).toEqual(['user:alice']);
    const published = await fixture.db.transaction(async (tx) => {
      const wrapped = wrapMutationDb(tx, fixture.env);
      await publishPuzzleContentMutation(fixture.puzzleContents).run(
        { tx: wrapped.tx, env: fixture.env },
        {
          documentId: 'river',
          draftId: 'private-river-next',
        }
      );
      return wrapped.getCapture();
    });
    expect(
      await topicsFromWriteCapture({
        topicMap: CONTENT_TOPIC_MAP,
        capture: published,
        ctx: topicMapCtxFromEnv(fixture.env),
      })
    ).toEqual([puzzleContentTopic, 'user:alice']);
  });
});
