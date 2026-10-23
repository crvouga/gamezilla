import { DefineBackButton } from '@libs/spaces-client-ts/spaces-nav-context';
import { useLingui } from '@lingui/solid/macro';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import { createPuzzleContentCatalog } from '@pkgs/turn-game-shared-ts/puzzle-content-catalog';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { useConfirmNavigation } from '@pkgs/ui-root-client-ts/pending-navigation';
import {
  createMemo,
  createSignal,
  type JSX,
  Match,
  Show,
  Switch,
} from 'solid-js';
import { ContentAttemptScreen } from './content-attempt-screen';
import { ContentAuthorScreen } from './content-author-screen';
import { ContentEditionScreen } from './content-edition-screen';
import { ContentGameProvider, type ContentView } from './content-game-context';
import { ContentLibraryProvider } from './content-library-context';
import { ContentLibraryScreen } from './content-library-screen';
import type { PuzzleContentClient } from './puzzle-content-client';
import { useContentAttempts } from './use-content-attempts';
import { useContentLibrary } from './use-content-library';

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

/** One shared content experience for both independent and turn-based games. */
export function ContentExperience(props: {
  gameId: string;
  title: string;
  content: PuzzleContent;
  client: PuzzleContentClient;
  onBack: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const engine = useSyncEngine();
  const content = useContentLibrary(() => props.gameId);
  const play = useContentAttempts(() => props.gameId);
  const [view, setView] = createSignal<ContentView>({ kind: 'library' });
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
        }}
      >
        <DefineBackButton onPress={back} />
        <Show when={engine.status().lastError}>
          {(error) => (
            <ErrorState
              variant="compact"
              title={t`Changes have not reached your other devices`}
              body={error()}
              retry={{
                label: t`Reconnect`,
                onClick: () => {
                  void engine.connect();
                },
              }}
            />
          )}
        </Show>
        <Show when={!engine.status().online}>
          <Notice>{t`You are offline. Available puzzles and your saved work stay on this device. Changes share when connected.`}</Notice>
        </Show>
        <Show
          when={!content.isLoading() && !play.isLoading()}
          fallback={<LoadingState />}
        >
          <ContentScreen view={view()} />
        </Show>
      </ContentLibraryProvider>
    </ContentGameProvider>
  );
}
