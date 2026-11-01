import { withBundledContent } from '@libs/game-puzzle-shared-ts/bundled-content';
import { DefineBackButton } from '@libs/spaces-client-ts/spaces-nav-context';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
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
import { ContentGameProvider, type ContentView } from './content-game-context';
import { ContentLibraryProvider } from './content-library-context';
import { ContentLibraryScreen } from './content-library-screen';
import { contentSubscriptionPlan } from './content-subscription-plan';
import type { PuzzleContentClient } from './puzzle-content-client';
import { useContentAttempts } from './use-content-attempts';
import { useContentLibrary } from './use-content-library';
import { useContentPages } from './use-content-pages';
import { useContentSubscriptions } from './use-content-subscriptions';

function ContentScreen(props: { view: ContentView }): JSX.Element {
  const edit = () => (props.view.kind === 'edit' ? props.view : null);
  const edition = () => (props.view.kind === 'edition' ? props.view : null);
  const attempt = () => (props.view.kind === 'attempt' ? props.view : null);
  return (
    <Switch fallback={<ContentLibraryScreen />}>
      <Match when={edit()?.documentId} keyed>
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
  const [view, setView] = createSignal<ContentView>({ kind: 'library' });
  const pages = useContentPages(content.library, play.library, view);
  const ready = useContentSubscriptions(() =>
    contentSubscriptionPlan({
      gameId: props.gameId,
      view: view(),
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
  const confirm = useConfirmNavigation();
  const open = (next: ContentView): void => confirm(() => setView(next));
  const back = (): void => {
    const current = view();
    if (current.kind === 'library') props.onBack();
    else if (current.kind === 'edition' && current.packRevisionId !== null)
      open({
        kind: 'edition',
        revisionId: current.packRevisionId,
        packRevisionId: null,
      });
    else open({ kind: 'library' });
  };
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
        open,
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
        <DefineBackButton onPress={back} />
        <ContentConnectionStatus loading={started() && fetching()} />
        <Show
          when={started() && !content.isLoading() && !play.isLoading()}
          fallback={<LoadingState />}
        >
          <ContentScreen view={view()} />
        </Show>
      </ContentLibraryProvider>
    </ContentGameProvider>
  );
}
