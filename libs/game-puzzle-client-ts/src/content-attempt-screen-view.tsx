import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
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

/** Where the puzzle sits in the pack it is played from. */
export type ContentAttemptPack = {
  readonly title: string;
  /** The puzzle's place in the pack, from 1. */
  readonly position: number;
  readonly total: number;
};

export type ContentAttemptScreenViewProps = {
  readonly status: ContentAttemptStatus;
  /** Set when the person may not change this attempt. */
  readonly denial?: DenialView | undefined;
  readonly attempt: ContentAttemptSummary;
  /** The pack this attempt is played from; absent for a puzzle on its own. */
  readonly pack?: ContentAttemptPack | null | undefined;
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

/** Where the last change stands: saved, or still being saved. */
function SaveStatus(props: ContentAttemptScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
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
  );
}

/**
 * What stops play or needs the person first, above the board on every
 * size: rules this app lacks, or a change that was not saved.
 */
function AttemptAlerts(props: ContentAttemptScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <>
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
    </>
  );
}

/** `Puzzle 3 of 4 in Warehouse basics`, for a puzzle played from a pack. */
function PackPlace(props: { pack: ContentAttemptPack }): JSX.Element {
  return (
    <P variant="label" testId="puzzle-attempt-pack-place">
      <Trans>
        Puzzle {props.pack.position} of {props.pack.total} in {props.pack.title}
      </Trans>
    </P>
  );
}

/**
 * The puzzle panel: beside the board when wide, under it on a phone, as a
 * game's record is. Where the puzzle sits in its pack, what it asks, a
 * playtest's note, the completion and the save status. It is secondary:
 * the attempt's commands sit with the board, not at the panel's foot.
 */
function AttemptPanel(props: ContentAttemptScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <GameSection
      title={<Trans>This puzzle</Trans>}
      dataSet={{ testid: 'puzzle-attempt-panel' }}
    >
      <StackVertical gap="sm">
        <Show when={props.pack}>{(pack) => <PackPlace pack={pack()} />}</Show>
        <Show when={props.attempt.description}>
          <P tone="secondary">{props.attempt.description}</P>
        </Show>
        <SaveStatus {...props} />
      </StackVertical>
      <Show when={props.playtest}>
        <Notice>
          <Trans>
            Playtest: this uses the real puzzle rules. It does not count toward
            personal or pack completion.
          </Trans>
        </Notice>
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
    </GameSection>
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
      facts={
        <Show when={props.attempt.difficulty}>
          {(difficulty) => <Badge intent="neutral" label={difficulty()} />}
        </Show>
      }
    >
      {/* The commands (undo, redo, restart, the pack) sit with the board:
          right under it on a phone, heading the rail beside it when wide,
          so the puzzle panel never stands between the board and them. */}
      <GameSessionLayout
        notices={<AttemptAlerts {...props} />}
        actions={props.controls}
        actionsBeside
        aside={<AttemptPanel {...props} />}
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
 * presentational: the puzzle's title and difficulty, the game's player on
 * the saved position as the hero with the attempt's commands right by it,
 * and beside it (under it on a phone) the puzzle panel: its place in the
 * pack, what it asks, the save status and completion — or denied and
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
