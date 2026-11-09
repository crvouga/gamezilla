import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { MetricStrip } from '@pkgs/ui-root-client-ts/metric-strip';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { ProgressBar } from '@pkgs/ui-root-client-ts/progress-bar';
import { SuccessState } from '@pkgs/ui-root-client-ts/success-state';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Match, Show, Switch } from 'solid-js';
import type { PuzzleContentFrame } from './puzzle-content-client';

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
  /**
   * A completion of this puzzle is already saved. Once the board is played
   * away from solved (a restart, an undo), the panel says so quietly
   * instead of repeating the full completion message.
   */
  readonly solvedBefore?: boolean | undefined;
  /** Published under rules this app version does not have. */
  readonly rulesChanged: boolean;
  /** The saved position cannot be projected onto the board. */
  readonly unopenable: boolean;
  /** The puzzle itself cannot be read, so restarting cannot help either. */
  readonly unreadable?: boolean | undefined;
  /** The game's player on the attempt's position. */
  readonly player?: JSX.Element;
  /** Undo / redo, restart and next. */
  readonly controls?: JSX.Element;
  /** Where the board sits on a one-column screen. */
  readonly stageAlign?: 'start' | 'center' | undefined;
  /** Earlier kept continuations to choose from. */
  readonly keptPositions?: JSX.Element;
  /**
   * The game's own figures for where the attempt stands, by its labels
   * (`Connected pairs 2`, `Moves 12`); empty when it gives none.
   */
  readonly figures?: readonly AttemptFigure[] | undefined;
  readonly figuresPlacement?: PuzzleContentFrame['figuresPlacement'];
  readonly onRetryChange: () => void;
  readonly onReturnToLibrary: () => void;
};

/** One of the game's figures for the attempt: its label and value. */
export type AttemptFigure = {
  readonly key: string;
  readonly label: string;
  readonly value: string;
};

/** Where the attempt stands in the game's own figures, under the pack's bar. */
function AttemptFigures(props: ContentAttemptScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <Show
      when={
        props.figuresPlacement !== 'board' && (props.figures?.length ?? 0) > 0
      }
    >
      <MetricStrip
        aria-label={t`This attempt`}
        dataSet={{ testid: 'puzzle-attempt-figures' }}
        metrics={(props.figures ?? []).map((figure) => ({
          label: figure.label,
          value: figure.value,
        }))}
      />
    </Show>
  );
}

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
        : t`Progress saved on this device.`}
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

/**
 * What the puzzle asks ("Join each pair of numbers and fill every
 * square."), right above the board it is played on, at every size.
 */
function AttemptRule(props: ContentAttemptScreenViewProps): JSX.Element {
  return (
    <Show when={props.attempt.description}>
      <P tone="secondary" testId="puzzle-attempt-rule">
        {props.attempt.description}
      </P>
    </Show>
  );
}

/** `Puzzle 3 of 4 in Warehouse basics`, for a puzzle played from a pack. */
function PackPlace(props: { pack: ContentAttemptPack }): JSX.Element {
  return (
    <Text variant="inherit" testId="puzzle-attempt-pack-place">
      <Trans>
        Puzzle {props.pack.position} of {props.pack.total} in {props.pack.title}
      </Trans>
    </Text>
  );
}

/** How far through its pack this puzzle is, as a bar under its place. */
function PackTrack(props: { pack: ContentAttemptPack }): JSX.Element {
  const { t } = useLingui();
  return (
    <ProgressBar
      size="sm"
      progress={props.pack.position / Math.max(1, props.pack.total)}
      accessibleLabel={t`Puzzle ${props.pack.position} of ${props.pack.total}`}
      dataSet={{ testid: 'puzzle-attempt-pack-track' }}
    />
  );
}

/**
 * The puzzle panel: beside the board when wide, under it on a phone, as a
 * game's record is. Compact, what is useful first: its heading says where
 * the puzzle sits in its pack ("Puzzle 3 of 4 in Warehouse basics", or
 * "This puzzle" on its own) over a bar of how far through the pack it is,
 * then the game's own figures for the attempt, a playtest's note and the completion, and last the save status in
 * one short quiet line. It is secondary: the attempt's commands sit with
 * the board, not at the panel's foot.
 */
function AttemptPanel(props: ContentAttemptScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <GameSection
      title={
        <Show when={props.pack} fallback={<Trans>This puzzle</Trans>}>
          {(pack) => <PackPlace pack={pack()} />}
        </Show>
      }
      dataSet={{ testid: 'puzzle-attempt-panel' }}
    >
      <Show when={props.pack}>{(pack) => <PackTrack pack={pack()} />}</Show>
      <AttemptFigures {...props} />
      <SaveStatus {...props} />
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
          title={props.playtest ? t`Playtest solved` : t`Completion saved`}
          body={
            props.playtest
              ? t`Return to the builder to validate and publish this puzzle.`
              : t`Your completion is saved. You can keep playing or choose another puzzle.`
          }
        />
      </Show>
      <Show
        when={!props.complete && !props.playtest && props.solvedBefore === true}
      >
        <P
          variant="caption"
          tone="secondary"
          testId="content-attempt-solved-before"
        >
          {t`Solved before. Your completion stays saved.`}
        </P>
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
      keepTitle
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
        notices={
          <>
            <AttemptRule {...props} />
            <AttemptAlerts {...props} />
          </>
        }
        actions={props.controls}
        actionsBeside
        stageAlign={props.stageAlign}
        aside={<AttemptPanel {...props} />}
      >
        <Show
          when={!props.unopenable}
          fallback={
            <Notice tone="error">
              <Show
                when={props.unreadable === true}
                fallback={
                  <Trans>
                    This saved position cannot be opened. Choose another kept
                    continuation below, or restart. Your earlier attempt stays
                    saved.
                  </Trans>
                }
              >
                <Trans>
                  This puzzle cannot be opened. Your attempt stays saved. Return
                  to the library to choose another puzzle.
                </Trans>
              </Show>
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
