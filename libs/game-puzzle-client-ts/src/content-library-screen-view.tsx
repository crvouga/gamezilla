import type {
  ContentKind,
  ContentRevision,
} from '@libs/game-puzzle-shared-ts/content-types';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { useLingui } from '@lingui/solid/macro';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { type JSX, Match, Show, Switch } from 'solid-js';
import type { ContentLibraryProgress } from './content-library-card';
import { ContentLibraryHubView } from './content-library-hub-view';
import {
  ContentLibraryBrowseView,
  ContentLibraryContinueView,
  ContentLibraryMineView,
  ContentLibraryPlaytestsView,
  ContentLibrarySolvedView,
} from './content-library-list-view';
import type { ContentLibraryPlace } from './content-places';
import type { ContentCreateState } from './use-content-create';

/**
 * A puzzle definition a row's thumbnail draws (a pack's: its first
 * puzzle's); absent when there is nothing to draw yet.
 */
type ContentPreviewSource = {
  readonly preview?: string | undefined;
};

/** A shipped starter pack or a published puzzle or pack, as listed. */
export type ContentLibraryEdition = Pick<
  ContentRevision,
  'id' | 'document_id' | 'kind' | 'title' | 'description' | 'difficulty'
> &
  ContentPreviewSource & {
    /** A pack's puzzles the person has solved; absent for a puzzle. */
    readonly progress?: ContentLibraryProgress | undefined;
  };

/** One of the person's own drafts or publications. */
export type ContentLibraryDraft = ContentPreviewSource & {
  /** The document id. */
  readonly id: string;
  readonly kind: ContentKind;
  /** The working copy's title; empty shows "Untitled draft". */
  readonly title: string;
  readonly status: 'draft' | 'published' | 'withdrawn';
};

/** A saved attempt or private playtest, with the title of what it plays. */
export type ContentLibraryAttempt = ContentPreviewSource & {
  readonly id: string;
  /** Empty when the source has not reached this device. */
  readonly title: string;
  readonly completed: boolean;
  /** The difficulty its author gave the puzzle; empty when none. */
  readonly difficulty?: string | undefined;
  /** The pack it was started in, and how much of that pack is solved. */
  readonly pack?:
    | (ContentLibraryProgress & { readonly title: string })
    | undefined;
};

/** Which lists have a further page to load. */
export type ContentLibraryMore = {
  readonly owned: boolean;
  readonly attempts: boolean;
  readonly published: boolean;
};

export type ContentLibraryScreenViewProps = {
  /** `loading` until the stored library is read. */
  readonly status: 'loading' | 'ready';
  /** The small screen shown: the hub, or one of its lists. */
  readonly place: ContentLibraryPlace;
  readonly onOpen: (place: ContentLibraryPlace) => void;
  /** The game's name. */
  readonly title: string;
  /** Where creating a draft from the hub stands. */
  readonly create: ContentCreateState;
  /** Set when the person may not create content; replaces the create rows. */
  readonly createDenial?: DenialView | undefined;
  /** The game has a puzzle editor, so a puzzle (not only a pack) can be made. */
  readonly canCreatePuzzle: boolean;
  readonly onCreate: (kind: ContentKind) => void;
  readonly bundledPacks: readonly ContentLibraryEdition[];
  /** Set when the person may not read their own content. */
  readonly personalDenial?: DenialView | undefined;
  readonly drafts: readonly ContentLibraryDraft[];
  readonly attempts: readonly ContentLibraryAttempt[];
  readonly playtests: readonly ContentLibraryAttempt[];
  readonly published: readonly ContentLibraryEdition[];
  readonly more: ContentLibraryMore;
  /**
   * The game's board preview for a puzzle definition, drawn small at the
   * start of each row; without it a row shows what kind of thing it is.
   */
  readonly renderPreview?: ((definition: string) => JSX.Element) | undefined;
  readonly onOpenEdition: (revisionId: string) => void;
  readonly onOpenDraft: (documentId: string) => void;
  readonly onOpenAttempt: (attemptId: string) => void;
  readonly onMoreOwned: () => void;
  readonly onMoreAttempts: () => void;
  readonly onMorePublished: () => void;
};

/** The screen's name on each of its lists; the hub is named after the game. */
function usePlaceTitle(props: ContentLibraryScreenViewProps): () => string {
  const { t } = useLingui();
  return () =>
    ({
      library: props.title,
      continue: t`Continue`,
      solved: t`Solved`,
      browse: t`Browse`,
      mine: t`My creations`,
      playtests: t`Playtests`,
    })[props.place.screen];
}

/** What each small screen is for, in one line under its name. */
function usePlaceSubtitle(props: ContentLibraryScreenViewProps): () => string {
  const { t } = useLingui();
  return () =>
    ({
      library: t`Play puzzles, pick up where you left off, or make your own.`,
      continue: t`Puzzles you started, at the move you left them.`,
      solved: t`Puzzles you finished. Open one to play it again.`,
      browse: t`Published puzzles and packs.`,
      mine: t`Your drafts and publications.`,
      playtests: t`Practice runs of your own drafts.`,
    })[props.place.screen];
}

/**
 * What every library screen says first: a draft that could not be created,
 * with its retry, so the refusal stays whichever list is open.
 */
function LibraryNotices(props: ContentLibraryScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const failed = () =>
    props.create.status === 'failed' ? props.create : undefined;
  return (
    <Show when={failed()}>
      {(failure) => (
        <ErrorState
          variant="compact"
          title={t`Your draft was not created`}
          body={failure().message}
          retry={{ onClick: () => props.onCreate(failure().kind) }}
          dataSet={{ testid: 'content-create-failed' }}
        />
      )}
    </Show>
  );
}

/** The one small screen `place` names. */
function LibraryPlace(props: ContentLibraryScreenViewProps): JSX.Element {
  return (
    <Switch>
      <Match when={props.place.screen === 'library'}>
        <ContentLibraryHubView view={props} />
      </Match>
      <Match when={props.place.screen === 'continue'}>
        <ContentLibraryContinueView view={props} />
      </Match>
      <Match when={props.place.screen === 'solved'}>
        <ContentLibrarySolvedView view={props} />
      </Match>
      <Match when={props.place.screen === 'browse'}>
        <ContentLibraryBrowseView view={props} />
      </Match>
      <Match when={props.place.screen === 'mine'}>
        <ContentLibraryMineView view={props} />
      </Match>
      <Match when={props.place.screen === 'playtests'}>
        <ContentLibraryPlaytestsView view={props} />
      </Match>
    </Switch>
  );
}

/**
 * A game's puzzle library, presentational, as small screens. `library` is
 * the hub: rows to Continue, Solved, Browse and My creations (each with how
 * much it holds), the shipped starter packs, and creating a puzzle or a
 * pack as rows. `continue`, `solved`, `browse`, `mine` and `playtests` are
 * one list each, with its own empty state and its own "load more". A draft
 * that could not be created is said on every one of them. Data arrives as
 * props; `ContentLibraryScreen` reads it from the synced library.
 */
export function ContentLibraryScreenView(
  props: ContentLibraryScreenViewProps
): JSX.Element {
  const title = usePlaceTitle(props);
  const subtitle = usePlaceSubtitle(props);
  return (
    <Show when={props.status === 'ready'} fallback={<LoadingState />}>
      <Show when={props.place.screen} keyed>
        {(screen) => (
          <EmbeddedScreen
            screenId={
              screen === 'library'
                ? 'puzzle-content-library'
                : `puzzle-content-library-${screen}`
            }
            dataSet={{ testid: 'content-library', place: screen }}
            width={screen === 'library' ? 'menu' : 'list'}
            title={title()}
            subtitle={subtitle()}
          >
            <LibraryNotices {...props} />
            <LibraryPlace {...props} />
          </EmbeddedScreen>
        )}
      </Show>
    </Show>
  );
}
