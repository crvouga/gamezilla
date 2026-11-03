import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { SuccessState } from '@pkgs/ui-root-client-ts/success-state';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Match, Show, Switch } from 'solid-js';

/**
 * `gone`: no such attempt here; `missing`: the attempt is kept but what it
 * plays has not reached this device; `ready`: the attempt on its board.
 */
export type ContentAttemptStatus = 'gone' | 'missing' | 'ready';

/** The saved attempt and what it plays, as the screen names them. */
export type ContentAttemptSummary = {
  readonly id: string;
  readonly sourceId: string;
  readonly packRevisionId: string | null;
  readonly title: string;
  readonly difficulty: string;
  readonly description: string;
};

export type ContentAttemptScreenViewProps = {
  readonly status: ContentAttemptStatus;
  /** Set when the person may not change this attempt. */
  readonly denial?: DenialView | undefined;
  readonly attempt: ContentAttemptSummary;
  /** A private playtest of a draft: it counts toward no completion. */
  readonly playtest: boolean;
  /** The last change is still being saved. */
  readonly saving: boolean;
  /** Why the last change was not saved; the earlier position is kept. */
  readonly changeError: string | null;
  readonly complete: boolean;
  /** Published under rules this app version does not have. */
  readonly rulesChanged: boolean;
  /** The saved position cannot be projected onto the board. */
  readonly unopenable: boolean;
  /** The game's player on the attempt's position. */
  readonly player?: JSX.Element;
  /** Undo / redo, restart and next. */
  readonly controls?: JSX.Element;
  /** Earlier kept continuations to choose from. */
  readonly keptPositions?: JSX.Element;
  readonly onRetryChange: () => void;
  readonly onReturnToLibrary: () => void;
};

function AttemptNotices(props: ContentAttemptScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <P
        role="status"
        variant="caption"
        tone="secondary"
        dataSet={{ testid: 'content-position-save-status' }}
      >
        {props.saving
          ? t`Saving your position…`
          : t`Progress saved on this device. Changes share when connected.`}
      </P>
      <Show when={props.rulesChanged}>
        <Notice
          tone="warning"
          dataSet={{ testid: 'content-attempt-rules-changed' }}
        >
          <Trans>
            This puzzle needs a version of the app with its rules. Your saved
            attempt stays kept; update the app to continue it.
          </Trans>
        </Notice>
      </Show>
      <Show when={props.playtest}>
        <Notice>
          <Trans>
            Playtest: this uses the real puzzle rules. It does not count toward
            personal or pack completion.
          </Trans>
        </Notice>
      </Show>
      <Show when={props.changeError}>
        {(error) => (
          <ErrorState
            variant="compact"
            title={t`Your change was not saved`}
            body={error()}
            retry={{ onClick: props.onRetryChange }}
          />
        )}
      </Show>
      <Show when={props.complete}>
        <SuccessState
          variant="compact"
          dataSet={{ testid: 'content-attempt-complete' }}
          title={props.playtest ? t`Playtest solved` : t`Puzzle completed`}
          body={
            props.playtest
              ? t`Return to the builder to validate and publish this puzzle.`
              : t`Your completion is saved. You can keep playing or choose another puzzle.`
          }
        />
      </Show>
    </>
  );
}

function AttemptBody(props: ContentAttemptScreenViewProps): JSX.Element {
  return (
    <GameScreen
      screenId="puzzle-content-attempt"
      dataSet={{
        testid: 'content-attempt',
        attemptid: props.attempt.id,
        sourceid: props.attempt.sourceId,
        packrevisionid: props.attempt.packRevisionId ?? '',
      }}
      title={props.attempt.title}
      subtitle={props.attempt.difficulty}
    >
      <GameSessionLayout
        notices={<AttemptNotices {...props} />}
        aside={<P>{props.attempt.description}</P>}
        actions={props.controls}
      >
        <Show
          when={!props.unopenable}
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
          {props.player}
        </Show>
      </GameSessionLayout>
      {props.keptPositions}
    </GameScreen>
  );
}

/**
 * A saved attempt at a published puzzle or a private playtest,
 * presentational: the game's player on the saved position, its save
 * status, completion and recovery notices — or denied and
 * not-on-this-device states. Player and controls arrive as slots.
 */
export function ContentAttemptScreenView(
  props: ContentAttemptScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <Switch>
      <Match when={props.denial}>
        {(denial) => <DenialSurfaceView denial={denial()} />}
      </Match>
      <Match when={props.status === 'missing'}>
        <ErrorState
          title={t`This puzzle has not reached this device`}
          body={t`Return to puzzles, reconnect and open the attempt again. Your progress stays saved.`}
          secondary={{
            label: t`Return to puzzles`,
            onClick: () => props.onReturnToLibrary(),
          }}
        />
      </Match>
      <Match when={props.status === 'ready'}>
        <AttemptBody {...props} />
      </Match>
    </Switch>
  );
}
