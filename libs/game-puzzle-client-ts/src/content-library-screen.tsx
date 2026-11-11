import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { AttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import { isBundledContent } from '@libs/game-puzzle-shared-ts/bundled-content';
import {
  type ContentLibrary,
  discoverContent,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import { decodePackDefinition } from '@libs/game-puzzle-shared-ts/content-pack';
import type {
  ContentKind,
  ContentRevision,
} from '@libs/game-puzzle-shared-ts/content-types';
import { packProgress } from '@libs/game-puzzle-shared-ts/pack-progress';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { createMemo, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { useContentGame, useContentPlace } from './content-game-context';
import { useContentLibraryState } from './content-library-context';
import {
  type ContentLibraryAttempt,
  type ContentLibraryDraft,
  ContentLibraryScreenView,
} from './content-library-screen-view';
import { contentPlaceOf } from './content-places';
import { useContentCreate } from './use-content-create';
import { byContentId } from './use-content-pages';
import { useDeniedView } from './use-denied-view';

/**
 * The puzzle definition a row's thumbnail draws: a puzzle's own, or a
 * pack's first puzzle that has reached this device.
 */
function previewOf(
  content: ContentLibrary,
  kind: ContentKind,
  definition: string
): string | undefined {
  if (kind === 'puzzle') return definition || undefined;
  const items = decodePackDefinition(definition)?.items ?? [];
  for (const item of items) {
    const revision = content.revisions.find(
      (entry) => entry.id === item.revisionId
    );
    if (revision !== undefined) return revision.definition || undefined;
    const draft = workingContentDraft(content, item.puzzleId);
    if (draft !== null) return draft.definition || undefined;
  }
  return undefined;
}

/** How many of a pack's puzzles the person solved; absent for a puzzle. */
function progressOf(
  content: ContentLibrary,
  play: AttemptLibrary,
  edition: Pick<ContentRevision, 'id' | 'kind'>
) {
  if (edition.kind !== 'pack') return undefined;
  const progress = packProgress({ content, play, packRevisionId: edition.id });
  return progress === null
    ? undefined
    : { completed: progress.completedCount, total: progress.total };
}

/** A listed edition with the board its thumbnail draws and its progress. */
function withPreview(
  content: ContentLibrary,
  play: AttemptLibrary,
  edition: ContentRevision
) {
  return {
    ...edition,
    preview: previewOf(content, edition.kind, edition.definition),
    progress: progressOf(content, play, edition),
  };
}

/** The pack an attempt was started in, by title, with its solved count. */
function packOf(
  content: ContentLibrary,
  play: AttemptLibrary,
  packRevisionId: string | null
) {
  const pack =
    packRevisionId === null
      ? undefined
      : content.revisions.find((entry) => entry.id === packRevisionId);
  const progress =
    pack === undefined ? undefined : progressOf(content, play, pack);
  return pack === undefined || progress === undefined
    ? undefined
    : { title: pack.title, ...progress };
}

/** The saved attempts of `mode` on the loaded page, titled by their source. */
function savedAttempts(args: {
  content: ContentLibrary;
  play: AttemptLibrary;
  limit: number;
  mode: 'ordinary' | 'playtest';
}): readonly ContentLibraryAttempt[] {
  return args.play.attempts
    .slice(0, args.limit)
    .filter((attempt) => attempt.mode === args.mode)
    .map((attempt) => {
      const source =
        args.mode === 'ordinary'
          ? args.content.revisions.find(
              (entry) => entry.id === attempt.source_id
            )
          : args.content.drafts.find((entry) => entry.id === attempt.source_id);
      return {
        id: attempt.id,
        title: source?.title ?? '',
        preview: source?.definition,
        difficulty: source?.difficulty,
        pack: packOf(args.content, args.play, attempt.pack_revision_id),
        completed:
          args.mode === 'ordinary' &&
          args.play.completions.some(
            (entry) => entry.puzzle_revision_id === attempt.source_id
          ),
      };
    });
}

/** The person's own drafts and publications on the loaded page. */
function ownedDrafts(
  content: ContentLibrary,
  ownerId: string,
  limit: number
): readonly ContentLibraryDraft[] {
  return content.documents
    .filter((doc) => doc.owner_id === ownerId)
    .toSorted(byContentId)
    .slice(0, limit)
    .filter((doc) => doc.deleted_at === null)
    .map((doc) => {
      const draft = workingContentDraft(content, doc.id);
      return {
        id: doc.id,
        kind: doc.kind,
        title: draft?.title ?? '',
        status: doc.status,
        preview: previewOf(content, doc.kind, draft?.definition ?? ''),
      };
    });
}

/** Published (not shipped) editions on the loaded page, by id. */
function publishedEditions(
  content: ContentLibrary,
  play: AttemptLibrary,
  page: { readonly gameId: string; readonly limit: number }
) {
  const editions = discoverContent(
    {
      ...content,
      documents: content.documents
        .filter(
          (doc) =>
            doc.published_revision_id !== null && !isBundledContent(doc.id)
        )
        .toSorted(byContentId)
        .slice(0, page.limit),
    },
    page.gameId
  );
  return editions.map((edition) => withPreview(content, play, edition));
}

/** The library's small screens wired to the synced content, attempts and their pages. */
export function ContentLibraryScreen(): JSX.Element {
  const game = useContentGame();
  const nav = useContentPlace();
  const data = useContentLibraryState();
  const myId = useMyId();
  const decision = useDecision(PERMISSION.puzzlesReadOwnContent);
  const personalDenial = useDeniedView({
    get decision() {
      return decision();
    },
  });
  const mayCreate = useDecision(PERMISSION.puzzlesCreateContent);
  const createDenial = useDeniedView({
    get decision() {
      return mayCreate();
    },
  });
  const creation = useContentCreate();
  const pages = data.pages;
  const attempts = (mode: 'ordinary' | 'playtest') =>
    savedAttempts({
      content: data.content(),
      play: data.play(),
      limit: pages.attempts.limit(),
      mode,
    });
  const bundled = createMemo(() =>
    discoverContent(data.content(), game.id)
      .filter(
        (edition) => edition.kind === 'pack' && isBundledContent(edition.id)
      )
      .map((edition) => withPreview(data.content(), data.play(), edition))
  );
  const preview = game.client.Preview;
  const openEdition = (revisionId: string): void =>
    game.open({ kind: 'edition', revisionId, packRevisionId: null });
  return (
    <ContentLibraryScreenView
      status={data.isLoading() ? 'loading' : 'ready'}
      place={contentPlaceOf('library', nav.place())}
      onOpen={nav.open}
      title={game.title}
      create={creation.state()}
      createDenial={createDenial()}
      canCreatePuzzle={game.client.authoring !== undefined}
      onCreate={creation.create}
      bundledPacks={bundled()}
      personalDenial={personalDenial()}
      drafts={ownedDrafts(data.content(), myId(), pages.owned.limit())}
      attempts={attempts('ordinary')}
      playtests={attempts('playtest')}
      published={publishedEditions(data.content(), data.play(), {
        gameId: game.id,
        limit: pages.published.limit(),
      })}
      more={{
        owned: pages.owned.hasMore(),
        attempts: pages.attempts.hasMore(),
        published: pages.published.hasMore(),
      }}
      renderPreview={
        preview === undefined
          ? undefined
          : (definition) => (
              <Dynamic component={preview} definition={definition} />
            )
      }
      onOpenEdition={openEdition}
      onOpenDraft={(documentId) => game.open({ kind: 'builder', documentId })}
      onOpenAttempt={(attemptId) => game.open({ kind: 'attempt', attemptId })}
      onMoreOwned={pages.owned.more}
      onMoreAttempts={pages.attempts.more}
      onMorePublished={pages.published.more}
    />
  );
}
