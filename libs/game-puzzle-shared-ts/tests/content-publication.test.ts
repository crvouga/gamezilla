import { expect, test } from 'bun:test';
import {
  puzzleContentOwned,
  puzzleContentPublished,
} from '@libs/game-puzzle-shared-ts/content-queries';
import {
  readContentDocument,
  readContentRevision,
} from '@libs/game-puzzle-shared-ts/content-store';
import { publishPuzzleContentMutation as publish } from '@libs/game-puzzle-shared-ts/publish-content-mutation';
import { savePuzzleContentDraftMutation as save } from '@libs/game-puzzle-shared-ts/save-content-draft-mutation';
import { validatePuzzleContentDraftMutation as validate } from '@libs/game-puzzle-shared-ts/validate-content-mutation';
import { withdrawPuzzleContentMutation as withdraw } from '@libs/game-puzzle-shared-ts/withdraw-content-mutation';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';
import {
  CONTENT_BODY,
  createContentFixture,
  publishContentFixture,
  withContentFixture,
} from './content-fixture';

test('the publication transaction rechecks title, game details and ownership before creating any edition', async () => {
  await withContentFixture(async (fixture) => {
    const { db, env } = fixture;
    await createContentFixture(fixture, {
      id: 'river',
      title: 'River',
      definition: 'missing details',
    });
    await expect(
      db.transaction((tx) =>
        publish.run(
          { tx, env },
          { documentId: 'river', draftId: 'river-first' }
        )
      )
    ).rejects.toMatchObject({ code: 'PUZZLE_PUBLICATION_INVALID' });
    expect(await readContentRevision(db, 'river-first')).toBeNull();
    expect(await readContentDocument(db, 'river')).toMatchObject({
      status: 'draft',
      publication_count: 0,
    });
    await createContentFixture(fixture, { id: 'valley', title: 'Valley' });
    const bob = { ...env, actorId: 'bob', deviceId: 'bob-phone' };
    await expect(
      db.transaction((tx) =>
        publish.run(
          { tx, env: bob },
          { documentId: 'valley', draftId: 'valley-first' }
        )
      )
    ).rejects.toMatchObject({ code: 'not_granted' });
    expect(await readContentRevision(db, 'valley-first')).toBeNull();
    await createContentFixture(fixture, { id: 'untitled', title: '' });
    await expect(
      db.transaction((tx) =>
        publish.run(
          { tx, env },
          { documentId: 'untitled', draftId: 'untitled-first' }
        )
      )
    ).rejects.toMatchObject({ code: 'PUZZLE_PUBLICATION_INVALID' });
  });
});

test('a pack stores its ordered edition references independently of later puzzle changes', async () => {
  await withContentFixture(async (fixture) => {
    const { db, env } = fixture;
    await createContentFixture(fixture, { id: 'river', title: 'River' });
    await createContentFixture(fixture, { id: 'valley', title: 'Valley' });
    await publishContentFixture(fixture, 'river');
    await publishContentFixture(fixture, 'valley');
    const definition = JSON.stringify({
      items: [
        { puzzleId: 'valley', revisionId: 'valley-first' },
        { puzzleId: 'river', revisionId: 'river-first' },
      ],
    });
    await createContentFixture(fixture, {
      id: 'rivers',
      title: 'Rivers',
      kind: 'pack',
      definition,
    });
    await publishContentFixture(fixture, 'rivers');
    const original = await readContentRevision(db, 'rivers-first');
    await db.transaction((tx) =>
      save.run(
        { tx, env },
        {
          documentId: 'river',
          draftId: 'river-next',
          parentId: 'river-first',
          body: { ...CONTENT_BODY, title: 'Harbor' },
        }
      )
    );
    await db.transaction((tx) =>
      publish.run({ tx, env }, { documentId: 'river', draftId: 'river-next' })
    );
    await db.transaction((tx) =>
      withdraw.run({ tx, env }, { documentId: 'river' })
    );
    expect(await readContentRevision(db, 'rivers-first')).toEqual(original);
    expect(original?.definition).toBe(definition);
    expect(await readContentRevision(db, 'river-first')).toMatchObject({
      title: 'River',
    });
    await createContentFixture(fixture, {
      id: 'new-pack',
      title: 'More rivers',
      kind: 'pack',
      definition,
    });
    await expect(
      publishContentFixture(fixture, 'new-pack')
    ).rejects.toMatchObject({ code: 'PUZZLE_PUBLICATION_INVALID' });
  });
});

test('a valid flag or an incomplete witness cannot authorize invalid publication', async () => {
  await withContentFixture(async (fixture) => {
    const { db, env } = fixture;
    await createContentFixture(fixture, { id: 'river', title: 'River' });
    await db.transaction((tx) =>
      validate.run({ tx, env }, { documentId: 'river', draftId: 'river-first' })
    );
    await db.transaction((tx) =>
      save.run(
        { tx, env },
        {
          documentId: 'river',
          parentId: 'river-first',
          draftId: 'invalid-draft',
          body: { ...CONTENT_BODY, definition: 'missing details' },
        }
      )
    );
    await expect(
      db.transaction((tx) =>
        publish.run(
          { tx, env },
          { documentId: 'river', draftId: 'invalid-draft' }
        )
      )
    ).rejects.toMatchObject({ code: 'PUZZLE_PUBLICATION_INVALID' });
    await createContentFixture(fixture, { id: 'valley', title: 'Valley' });
    await expect(
      db.transaction((tx) =>
        publish.run(
          { tx, env },
          {
            documentId: 'valley',
            draftId: 'valley-first',
            solution: 'pile:2:white',
          }
        )
      )
    ).rejects.toMatchObject({ code: 'PUZZLE_PUBLICATION_INVALID' });
  });
});

test('public hydration never includes draft bodies and another actor receives no private working copies', async () => {
  await withContentFixture(async (fixture) => {
    const { db, env } = fixture;
    await createContentFixture(fixture, {
      id: 'river',
      title: 'Private river',
    });
    await createContentFixture(fixture, {
      id: 'valley',
      title: 'Public valley',
    });
    await publishContentFixture(fixture, 'valley');
    const bobCtx = {
      db: { query: (q: Sql<unknown>) => db.query(q as Sql<QueryRow>) },
      env: { ...env, actorId: 'bob', deviceId: 'bob-phone' },
    };
    expect(await puzzleContentOwned.run(bobCtx, {})).toEqual({
      puzzle_content_documents: [],
      puzzle_content_drafts: [],
      puzzle_content_revisions: [],
      puzzle_content_pack_items: [],
    });
    const publicRows = await puzzleContentPublished.run(bobCtx, {});
    expect(publicRows['puzzle_content_drafts']).toBeUndefined();
    expect(publicRows['puzzle_content_documents']).toHaveLength(1);
    expect(publicRows['puzzle_content_revisions']).toHaveLength(1);
    expect(publicRows['puzzle_content_revisions']?.[0]?.['title']).toBe(
      'Public valley'
    );
  });
});
