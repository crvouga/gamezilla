import { projectAttemptPosition } from '@libs/game-puzzle-shared-ts/attempt-library';
import type { ContentAttempt } from '@libs/game-puzzle-shared-ts/attempt-types';
import type { ContentBody } from '@libs/game-puzzle-shared-ts/content-types';
import { DenialSurface } from '@libs/permissions-client-ts/denial-surface';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { Trans, useLingui } from '@lingui/solid/macro';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createMemo, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { ContentAttemptControls } from './content-attempt-controls';
import { ContentAttemptNotices } from './content-attempt-notices';
import { useContentGame } from './content-game-context';
import { ContentKeptPositions } from './content-kept-positions';
import { useContentLibraryState } from './content-library-context';
import { useContentAttemptChange } from './use-content-attempt-change';

function AttemptBody(props: {
  attempt: ContentAttempt;
  source: ContentBody;
}): JSX.Element {
  const game = useContentGame();
  const data = useContentLibraryState();
  const writer = useContentAttemptChange(() => props.attempt);
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
  return (
    <GameScreen
      screenId="puzzle-content-attempt"
      dataSet={{
        testid: 'content-attempt',
        attemptid: props.attempt.id,
        sourceid: props.attempt.source_id,
        packrevisionid: props.attempt.pack_revision_id ?? '',
      }}
      title={props.source.title}
      subtitle={props.source.difficulty}
    >
      <GameSessionLayout
        notices={
          <ContentAttemptNotices
            writer={writer}
            playtest={props.attempt.mode === 'playtest'}
            complete={progress()?.complete ?? false}
          />
        }
        aside={<P>{props.source.description}</P>}
        actions={
          <ContentAttemptControls
            attempt={props.attempt}
            writer={writer}
            progress={progress()}
          />
        }
      >
        <Show
          when={progress()}
          fallback={
            <Notice tone="error">
              <Trans>
                This saved position cannot be opened. Choose another kept
                continuation below, or restart. Your earlier attempt stays
                saved.
              </Trans>
            </Notice>
          }
        >
          {(state) => (
            <Dynamic
              component={game.client.Player}
              definition={props.source.definition}
              state={state().state}
              disabled={writer.pending()}
              onAction={(action: string) =>
                writer.execute({ kind: 'play', action })
              }
            />
          )}
        </Show>
      </GameSessionLayout>
      <ContentKeptPositions
        attempt={props.attempt}
        disabled={writer.pending()}
      />
    </GameScreen>
  );
}

export function ContentAttemptScreen(props: {
  attemptId: string;
}): JSX.Element {
  const { t } = useLingui();
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
  return (
    <Show
      when={decision().allowed}
      fallback={<DenialSurface decision={decision()} />}
    >
      <Show when={attempt()}>
        {(current) => (
          <Show
            when={source()}
            fallback={
              <ErrorState
                title={t`This puzzle has not reached this device`}
                body={t`Return to puzzles, reconnect and open the attempt again. Your progress stays saved.`}
                secondary={{
                  label: t`Return to puzzles`,
                  onClick: () => game.open({ kind: 'library' }),
                }}
              />
            }
          >
            {(edition) => (
              <AttemptBody attempt={current()} source={edition()} />
            )}
          </Show>
        )}
      </Show>
    </Show>
  );
}
