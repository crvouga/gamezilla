import { withBundledContent } from '@libs/game-puzzle-shared-ts/bundled-content';
import {
  DefineBackButton,
  useGameChoicesName,
} from '@libs/spaces-client-ts/spaces-nav-context';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useScreenPlace } from '@pkgs/turn-game-client-ts/use-screen-place';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import { createPuzzleContentCatalog } from '@pkgs/turn-game-shared-ts/puzzle-content-catalog';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { useConfirmNavigation } from '@pkgs/ui-root-client-ts/pending-navigation';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  Match,
  Show,
  Switch,
} from 'solid-js';
import { ContentAttemptScreen } from './content-attempt-screen';
import { ContentAuthorScreen } from './content-author-screen';
import { ContentConnectionStatus } from './content-connection-status';
import { ContentEditionScreen } from './content-edition-screen';
import {
  ContentGameProvider,
  ContentPlaceProvider,
} from './content-game-context';
import { ContentLibraryProvider } from './content-library-context';
import { ContentLibraryScreen } from './content-library-screen';
import {
  CONTENT_PLACES,
  type ContentSubject,
  contentStageOf,
} from './content-places';
import { contentSubscriptionPlan } from './content-subscription-plan';
import type { PuzzleContentClient } from './puzzle-content-client';
import { useContentAttempts } from './use-content-attempts';
import { useContentLibrary } from './use-content-library';
import { useContentPages } from './use-content-pages';
import { useContentSubscriptions } from './use-content-subscriptions';

/** The screens of what is open: one container per stage. */
function ContentScreen(props: { subject: ContentSubject }): JSX.Element {
  const builder = () =>
    props.subject.kind === 'builder' ? props.subject : null;
  const edition = () =>
    props.subject.kind === 'edition' ? props.subject : null;
  const attempt = () =>
    props.subject.kind === 'attempt' ? props.subject : null;
  return (
    <Switch fallback={<ContentLibraryScreen />}>
      <Match when={builder()?.documentId} keyed>
        {(id) => <ContentAuthorScreen documentId={id} />}
      </Match>
      <Match when={edition()?.revisionId} keyed>
        {(id) => (
          <ContentEditionScreen
            revisionId={id}
            packRevisionId={edition()?.packRevisionId ?? null}
          />
        )}
      </Match>
      <Match when={attempt()?.attemptId} keyed>
        {(id) => <ContentAttemptScreen attemptId={id} />}
      </Match>
    </Switch>
  );
}

/** Shipped editions are part of every device's library, offline included. */
function useGameLibrary(
  gameId: Accessor<string>,
  game: Accessor<PuzzleContent>
) {
  const stored = useContentLibrary(gameId);
  const library = createMemo(() =>
    withBundledContent(stored.library(), gameId(), game())
  );
  return { library, isLoading: stored.isLoading };
}

/** Back from the library's hub names the game's choices it returns to. */
function ContentBack(props: {
  onPress: () => void;
  atLibrary: boolean;
}): JSX.Element {
  const choices = useGameChoicesName();
  return (
    <DefineBackButton
      onPress={props.onPress}
      label={props.atLibrary ? choices() : undefined}
    />
  );
}

/**
 * What is open and the small screen shown of it. Opening something always
 * starts on its home (also another thing of the same kind) and asks first
 * when unsaved work would be lost; Back goes one place back, then from a
 * home to the pack an edition was opened from, else to the library, and
 * from the library's hub out of the template.
 */
function useContentNavigation(onBack: () => void) {
  const [subject, setSubject] = createSignal<ContentSubject>({
    kind: 'library',
  });
  const nav = useScreenPlace(CONTENT_PLACES, () => contentStageOf(subject()));
  const confirm = useConfirmNavigation();
  const open = (next: ContentSubject): void =>
    confirm(() => {
      setSubject(next);
      nav.home();
    });
  const leave = (): void => {
    const current = subject();
    if (current.kind === 'library') onBack();
    else if (current.kind === 'edition' && current.packRevisionId !== null)
      open({
        kind: 'edition',
        revisionId: current.packRevisionId,
        packRevisionId: null,
      });
    else open({ kind: 'library' });
  };
  const back = (): void => {
    if (!nav.back()) leave();
  };
  return { subject, place: nav.place, openPlace: nav.open, open, back };
}

/** One shared content experience for both independent and turn-based games. */
export function ContentExperience(props: {
  gameId: string;
  title: string;
  content: PuzzleContent;
  client: PuzzleContentClient;
  onBack: () => void;
}): JSX.Element {
  const engine = useSyncEngine();
  const content = useGameLibrary(
    () => props.gameId,
    () => props.content
  );
  const play = useContentAttempts(() => props.gameId);
  const nav = useContentNavigation(() => props.onBack());
  const pages = useContentPages(content.library, play.library, nav.subject);
  const ready = useContentSubscriptions(() =>
    contentSubscriptionPlan({
      gameId: props.gameId,
      subject: nav.subject(),
      content: content.library(),
      play: play.library(),
      pages,
    })
  );
  const [started, setStarted] = createSignal(false);
  const fetching = () =>
    !ready() && engine.status().online && engine.status().lastError === null;
  createEffect(() => {
    if (
      ready() ||
      content.library().documents.length > 0 ||
      play.library().attempts.length > 0 ||
      !engine.status().online ||
      engine.status().lastError !== null
    )
      setStarted(true);
  });
  const catalog = createMemo(() =>
    createPuzzleContentCatalog([
      { id: props.gameId, puzzleContent: props.content },
    ])
  );
  return (
    <ContentGameProvider
      value={{
        get id() {
          return props.gameId;
        },
        get title() {
          return props.title;
        },
        get content() {
          return props.content;
        },
        get client() {
          return props.client;
        },
        get catalog() {
          return catalog();
        },
        open: nav.open,
      }}
    >
      <ContentLibraryProvider
        value={{
          content: content.library,
          play: play.library,
          isLoading: () => content.isLoading() || play.isLoading(),
          isFetching: fetching,
          pages,
        }}
      >
        <ContentPlaceProvider value={{ place: nav.place, open: nav.openPlace }}>
          <ContentBack
            onPress={nav.back}
            atLibrary={nav.place().screen === 'library'}
          />
          <ContentConnectionStatus loading={started() && fetching()} />
          <Show
            when={started() && !content.isLoading() && !play.isLoading()}
            fallback={<LoadingState />}
          >
            <ContentScreen subject={nav.subject()} />
          </Show>
        </ContentPlaceProvider>
      </ContentLibraryProvider>
    </ContentGameProvider>
  );
}
