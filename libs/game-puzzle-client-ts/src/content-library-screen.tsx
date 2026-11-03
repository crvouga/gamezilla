import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { AttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import { isBundledContent } from '@libs/game-puzzle-shared-ts/bundled-content';
import {
  type ContentLibrary,
  discoverContent,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { createMemo, type JSX } from 'solid-js';
import { ContentCreateControls } from './content-create-controls';
import { useContentGame } from './content-game-context';
import { useContentLibraryState } from './content-library-context';
import {
  type ContentLibraryAttempt,
  type ContentLibraryDraft,
  ContentLibraryScreenView,
} from './content-library-screen-view';
import { byContentId } from './use-content-pages';
import { useDeniedView } from './use-denied-view';

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
    .map((doc) => ({
      id: doc.id,
      title: workingContentDraft(content, doc.id)?.title ?? '',
      status: doc.status,
    }));
}

/** Published (not shipped) editions on the loaded page, by id. */
function publishedEditions(
  content: ContentLibrary,
  gameId: string,
  limit: number
) {
  return discoverContent(
    {
      ...content,
      documents: content.documents
        .filter(
          (doc) =>
            doc.published_revision_id !== null && !isBundledContent(doc.id)
        )
        .toSorted(byContentId)
        .slice(0, limit),
    },
    gameId
  );
}

/** The library wired to the synced content, attempts and their pages. */
export function ContentLibraryScreen(): JSX.Element {
  const game = useContentGame();
  const data = useContentLibraryState();
  const myId = useMyId();
  const decision = useDecision(PERMISSION.puzzlesReadOwnContent);
  const personalDenial = useDeniedView({
    get decision() {
      return decision();
    },
  });
  const pages = data.pages;
  const attempts = (mode: 'ordinary' | 'playtest') =>
    savedAttempts({
      content: data.content(),
      play: data.play(),
      limit: pages.attempts.limit(),
      mode,
    });
  const bundled = createMemo(() =>
    discoverContent(data.content(), game.id).filter(
      (edition) => edition.kind === 'pack' && isBundledContent(edition.id)
    )
  );
  const openEdition = (revisionId: string): void =>
    game.open({ kind: 'edition', revisionId, packRevisionId: null });
  return (
    <ContentLibraryScreenView
      status={data.isLoading() ? 'loading' : 'ready'}
      title={game.title}
      createControls={<ContentCreateControls />}
      bundledPacks={bundled()}
      personalDenial={personalDenial()}
      drafts={ownedDrafts(data.content(), myId(), pages.owned.limit())}
      attempts={attempts('ordinary')}
      playtests={attempts('playtest')}
      published={publishedEditions(
        data.content(),
        game.id,
        pages.published.limit()
      )}
      more={{
        owned: pages.owned.hasMore(),
        attempts: pages.attempts.hasMore(),
        published: pages.published.hasMore(),
      }}
      onOpenEdition={openEdition}
      onOpenDraft={(documentId) => game.open({ kind: 'edit', documentId })}
      onOpenAttempt={(attemptId) => game.open({ kind: 'attempt', attemptId })}
      onMoreOwned={pages.owned.more}
      onMoreAttempts={pages.attempts.more}
      onMorePublished={pages.published.more}
    />
  );
}
