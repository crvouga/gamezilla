import { projectAttemptPosition } from '@libs/game-puzzle-shared-ts/attempt-library';
import type { ContentAttempt } from '@libs/game-puzzle-shared-ts/attempt-types';
import type { ContentBody } from '@libs/game-puzzle-shared-ts/content-types';
import { packProgress } from '@libs/game-puzzle-shared-ts/pack-progress';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { createMemo, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { ContentAttemptControls } from './content-attempt-controls';
import {
  type AttemptFigure,
  type ContentAttemptPack,
  ContentAttemptScreenView,
  type ContentAttemptStatus,
  type ContentAttemptSummary,
} from './content-attempt-screen-view';
import { type ContentGame, useContentGame } from './content-game-context';
import { ContentKeptPositions } from './content-kept-positions';
import { useContentLibraryState } from './content-library-context';
import { puzzlePlayContext } from './puzzle-play-context';
import { useContentAttemptChange } from './use-content-attempt-change';
import { useDeniedView } from './use-denied-view';

function summaryOf(
  attempt: Pick<ContentAttempt, 'id' | 'source_id' | 'pack_revision_id'>,
  source: ContentBody | undefined
): ContentAttemptSummary {
  return {
    id: attempt.id,
    sourceId: attempt.source_id,
    packRevisionId: attempt.pack_revision_id,
    title: source?.title ?? '',
    difficulty: source?.difficulty ?? '',
    description: source?.description ?? '',
  };
}

/** Where the attempt's puzzle sits in the pack it is played from. */
function packPlace(
  attempt: Pick<ContentAttempt, 'source_id' | 'pack_revision_id'>,
  data: ReturnType<typeof useContentLibraryState>
): ContentAttemptPack | null {
  const id = attempt.pack_revision_id;
  if (id === null) return null;
  const pack = data.content().revisions.find((entry) => entry.id === id);
  const progress = packProgress({
    content: data.content(),
    play: data.play(),
    packRevisionId: id,
  });
  const index =
    progress?.items.findIndex(
      (item) => item.revisionId === attempt.source_id
    ) ?? -1;
  if (pack === undefined || progress === null || index < 0) return null;
  return { title: pack.title, position: index + 1, total: progress.total };
}

/** One attempt on its board, wired to its saved positions and changes. */
/** Whether the game can read the puzzle content at all. */
function readable(game: ContentGame, source: ContentBody): boolean {
  return game.content.rules.validateDefinition(source.definition).valid;
}

function AttemptBody(props: {
  attempt: ContentAttempt;
  source: ContentBody;
}): JSX.Element {
  const game = useContentGame();
  const data = useContentLibraryState();
  const writer = useContentAttemptChange(() => props.attempt);
  // An edition plays only under the rules it was published with.
  const rulesChanged = () =>
    props.attempt.rules_version !== game.content.rulesVersion;
  // A puzzle that cannot be read stays unreadable in a restarted attempt.
  const unreadable = createMemo(() => !readable(game, props.source));
  const progress = createMemo(() => {
    const saved = data
      .play()
      .positions.find(
        (entry) => entry.id === props.attempt.current_position_id
      );
    return saved === undefined
      ? null
      : projectAttemptPosition({
          position: saved,
          definition: props.source.definition,
          game: game.content,
        });
  });
  // The game's own figures for where the attempt stands, by its labels.
  const figures = createMemo((): AttemptFigure[] => {
    const state = progress()?.state;
    if (state === undefined) return [];
    const values =
      game.content.statistics?.(props.source.definition, state) ?? {};
    return Object.entries(game.client.frame.stats).flatMap(([key, label]) => {
      const value = values[key];
      return value === undefined
        ? []
        : [{ key, label: label(), value: String(value) }];
    });
  });
  return (
    <ContentAttemptScreenView
      status="ready"
      figures={figures()}
      attempt={summaryOf(props.attempt, props.source)}
      pack={packPlace(props.attempt, data)}
      playtest={props.attempt.mode === 'playtest'}
      stageAlign={game.client.frame.stageAlign}
      saving={writer.pending()}
      changeError={writer.change.error()?.message ?? null}
      complete={progress()?.complete ?? false}
      rulesChanged={rulesChanged()}
      unopenable={progress() === null}
      unreadable={unreadable()}
      player={
        <Show when={progress()}>
          {(state) => (
            <Dynamic
              component={game.client.Player}
              definition={props.source.definition}
              state={state().state}
              disabled={writer.pending() || rulesChanged()}
              onAction={(action: string) =>
                writer.execute({ kind: 'play', action })
              }
              context={puzzlePlayContext(props.attempt)}
            />
          )}
        </Show>
      }
      controls={
        <ContentAttemptControls
          attempt={props.attempt}
          writer={writer}
          progress={rulesChanged() ? null : progress()}
          unreadable={unreadable()}
        />
      }
      keptPositions={
        <ContentKeptPositions
          attempt={props.attempt}
          disabled={writer.pending()}
        />
      }
      onRetryChange={writer.retry}
      onReturnToLibrary={() => game.open({ kind: 'library' })}
    />
  );
}

/** `ContentAttemptScreenView` wired to the attempt library and permissions. */
export function ContentAttemptScreen(props: {
  attemptId: string;
}): JSX.Element {
  const game = useContentGame();
  const data = useContentLibraryState();
  const attempt = createMemo(() =>
    data.play().attempts.find((entry) => entry.id === props.attemptId)
  );
  const source = createMemo(() => {
    const current = attempt();
    return current?.mode === 'playtest'
      ? data.content().drafts.find((entry) => entry.id === current.source_id)
      : data
          .content()
          .revisions.find((entry) => entry.id === current?.source_id);
  });
  const decision = useDecision(PERMISSION.puzzlesEditAttempt, () => ({
    puzzlePlayerId: attempt()?.owner_id ?? '',
  }));
  const denial = useDeniedView({
    get decision() {
      return decision();
    },
  });
  /** The attempt and what it plays, once it may open. */
  const bodyInput = createMemo(() => {
    const current = attempt();
    const played = source();
    if (denial() !== undefined) return null;
    return current === undefined || played === undefined
      ? null
      : { attempt: current, source: played };
  });
  const status = (): ContentAttemptStatus => {
    if (attempt() === undefined) return 'gone';
    return source() === undefined ? 'missing' : 'ready';
  };
  return (
    <Show
      when={bodyInput()}
      fallback={
        <ContentAttemptScreenView
          status={status()}
          denial={denial()}
          attempt={summaryOf(
            attempt() ?? {
              id: props.attemptId,
              source_id: '',
              pack_revision_id: null,
            },
            undefined
          )}
          playtest={attempt()?.mode === 'playtest'}
          saving={false}
          changeError={null}
          complete={false}
          rulesChanged={false}
          unopenable={false}
          onRetryChange={() => undefined}
          onReturnToLibrary={() => game.open({ kind: 'library' })}
        />
      }
    >
      {(input) => (
        <AttemptBody attempt={input().attempt} source={input().source} />
      )}
    </Show>
  );
}
