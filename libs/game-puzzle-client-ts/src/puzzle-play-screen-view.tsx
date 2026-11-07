import type { PuzzleFeedConfig } from '@libs/game-puzzle-shared-ts/feed-config';
import type { HintStage } from '@libs/game-puzzle-shared-ts/hint-stage';
import type { SolveStatus } from '@libs/game-puzzle-shared-ts/solve-status';
import type { PuzzleStatusKind } from '@libs/game-puzzle-shared-ts/status-kind';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { BoardFit } from '@pkgs/ui-root-client-ts/board-fit';
import { CircleCheckIcon, FlameIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { createMeasure } from '@pkgs/ui-root-client-ts/measure';
import { PuzzleScreen } from '@pkgs/ui-root-client-ts/puzzle-screen';
import {
  SpeakingAvatar,
  type SpeakingAvatarSpeaker,
} from '@pkgs/ui-root-client-ts/speaking-avatar';
import { SpectatorIndicator } from '@pkgs/ui-root-client-ts/spectator-indicator';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { StatPill } from '@pkgs/ui-root-client-ts/stat-pill';
import { P } from '@pkgs/ui-root-client-ts/text';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { PuzzleActionBar } from './puzzle-action-bar';
import { PuzzleClockLabel } from './puzzle-clock-label';
import { PuzzleEmptyPoolState } from './puzzle-empty-pool-state';
import { PuzzleStatusHeader } from './puzzle-status-header';

/** The coach's face: small enough to leave its words a whole line beside a wide board. */
const AVATAR_SIZE = 48;

/** On a phone the coach's face is smaller still, so the prompt stays compact over the board. */
const COMPACT_AVATAR_SIZE = 36;

/**
 * What the board well holds: a placed puzzle (`playing`), one activity
 * indicator while a pick is pending (`loading`), or why no puzzle can be
 * placed — offline, the rated limit, an exhausted feed, or (spectating) a
 * host who has not started one.
 */
export type PuzzlePlayPick =
  | 'loading'
  | 'offline'
  | 'limited'
  | 'empty'
  | 'waiting'
  | 'playing';

/** The coach's line above the board. */
export type PuzzlePlayCoach = {
  readonly message: string;
  /** Changes when the position changes, so the same words are said again. */
  readonly contextKey?: string | undefined;
  /** Spec handles of a placed puzzle's line: what it observed and why. */
  readonly handles?:
    | {
        readonly observation: string;
        readonly purpose: string;
        readonly puzzleId: string;
      }
    | undefined;
};

export type PuzzlePlayScreenViewProps = {
  readonly pick: PuzzlePlayPick;
  /** Opt-in width-driven board, with coaching and help after it on phones. */
  readonly boardSizing?: 'fit' | 'width' | undefined;
  readonly statusKind: PuzzleStatusKind;
  /** The solver's side as the game names it, once a position is shown. */
  readonly solverSide?: string | null | undefined;
  /**
   * The solver's last move was right and the line goes on: the turn pill
   * takes the success colour ("Correct · White to move").
   */
  readonly correct?: boolean | undefined;
  readonly coach: PuzzlePlayCoach;
  /** The coach's words are still being chosen. */
  readonly coachResolving?: boolean | undefined;
  /** Reads the coach's line aloud; silent without. */
  readonly speaker?: SpeakingAvatarSpeaker | undefined;
  /** Elapsed solve time; null hides the clock. */
  readonly elapsedMs: number | null;
  /** Watching someone else solve: no feed, no actions, the allowance line. */
  readonly spectator: boolean;
  /** Rated puzzles left today (spectators); empty when unlimited. */
  readonly allowanceLabel: string;
  /** The share-this-puzzle control in the header (solver only). */
  readonly shareLink?: JSX.Element;
  /** The feed strip and its refused-change notice (solver only). */
  readonly feed?: JSX.Element;
  /**
   * The solver's own run so far: solved puzzles in a row and solved in
   * all, under the actions; absent for a spectator or before it is read.
   */
  readonly progress?:
    | { readonly streak: number; readonly solved: number }
    | undefined;
  /** Who suggested which move, while spectators suggest. */
  readonly legend?: JSX.Element;
  /** The move list under the board. */
  readonly timeline?: JSX.Element;
  /** The game's board at `size` px, while `playing`. */
  readonly board?: ((size: number) => JSX.Element) | undefined;
  /** The saved feed, for the exhausted-feed advice. */
  readonly feedConfig: PuzzleFeedConfig;
  /** The rated limit's resolved denial, for `limited`. */
  readonly denial?: DenialView | undefined;
  readonly status: SolveStatus;
  readonly hintStage: HintStage;
  readonly canGoForward: boolean;
  readonly onHint: () => void;
  readonly onSolution: () => void;
  readonly onRetry: () => void;
  readonly onSkip: () => void;
  readonly onNext: () => void;
  /** Drop history and theme filters so every synced puzzle is eligible. */
  readonly onIncludeAllPuzzles: () => void;
  readonly onOpenFeedSettings: () => void;
  /** Test-only pick probe (hidden). */
  readonly probe?: JSX.Element;
  /** Layers over the screen: the result, the feed settings, live regions. */
  readonly overlay?: JSX.Element;
};

/** Clock, spectator mark and share control at the end of the status row. */
function HeaderTrailing(props: PuzzlePlayScreenViewProps): JSX.Element {
  return (
    <>
      <PuzzleClockLabel elapsedMs={props.elapsedMs} />
      <Show when={props.spectator}>
        <SpectatorIndicator />
      </Show>
      <Show when={!props.spectator}>{props.shareLink}</Show>
    </>
  );
}

function PlayAssistant(props: PuzzlePlayScreenViewProps): JSX.Element {
  const handles = () => props.coach.handles;
  const mode = useLayoutMode();
  return (
    <SpeakingAvatar
      message={props.coach.message}
      contextKey={props.coach.contextKey}
      bubbleResolving={props.coachResolving}
      speaker={props.speaker}
      dataSet={handles() ? { testid: 'puzzle-assistant' } : undefined}
      data-observation={handles()?.observation}
      data-purpose={handles()?.purpose}
      data-puzzle={handles()?.puzzleId}
      header={
        <PuzzleStatusHeader
          kind={props.statusKind}
          solutionShown={props.status === 'revealed'}
          solverSide={props.solverSide ?? null}
          correct={props.correct}
          trailing={
            <Show when={props.pick === 'playing'}>
              <HeaderTrailing {...props} />
            </Show>
          }
        />
      }
      numberOfLines={2}
      avatarSize={mode() === 'wide' ? AVATAR_SIZE : COMPACT_AVATAR_SIZE}
    />
  );
}

/** Spectators see what is left of the rated allowance instead of the feed. */
function SpectatorAllowance(props: { label: string }): JSX.Element {
  return (
    <Show when={props.label.length > 0}>
      <StackVertical paddingX="md" paddingY="xs">
        <P
          variant="caption"
          tone="secondary"
          testId="chess-puzzle-remaining-today"
        >
          {props.label}
        </P>
      </StackVertical>
    </Show>
  );
}

type PoolKind = Exclude<PuzzlePlayPick, 'loading' | 'playing'>;

/** Why no puzzle can be placed, or null while one is or soon will be. */
function poolKind(pick: PuzzlePlayPick): PoolKind | null {
  return pick === 'loading' || pick === 'playing' ? null : pick;
}

function BoardWell(props: {
  view: PuzzlePlayScreenViewProps;
  size: number;
}): JSX.Element {
  const v = props.view;
  return (
    <Switch>
      <Match when={v.pick === 'playing'}>{v.board?.(props.size)}</Match>
      <Match when={v.pick === 'loading'}>
        <LoadingState size="lg" />
      </Match>
      <Match when={poolKind(v.pick)} keyed>
        {(kind) => (
          <PuzzleEmptyPoolState
            kind={kind}
            config={v.feedConfig}
            onIncludeAllPuzzles={v.onIncludeAllPuzzles}
            onOpenFeedSettings={v.onOpenFeedSettings}
            denial={v.denial}
          />
        )}
      </Match>
    </Switch>
  );
}

/**
 * What is done about the puzzle, at the page's one inset, so the actions
 * start where the feed and the coach above them do.
 */
function PlayActions(props: PuzzlePlayScreenViewProps): JSX.Element {
  return (
    <StackVertical paddingX="lg">
      <PuzzleActionBar
        status={props.status}
        hintStage={props.hintStage}
        canGoForward={props.canGoForward}
        onHint={props.onHint}
        onSolution={props.onSolution}
        onRetry={props.onRetry}
        onSkip={props.onSkip}
        onNext={props.onNext}
      />
    </StackVertical>
  );
}

/**
 * The run so far, as two quiet counts on the title's line: solved puzzles
 * in a row (lit while there is a streak to keep) and solved in all, so
 * each puzzle reads as a step toward the next.
 */
function PlayProgress(props: {
  readonly progress: PuzzlePlayScreenViewProps['progress'];
}): JSX.Element {
  return (
    <Show when={props.progress}>
      {(progress) => (
        <StackHorizontal wrap gap="sm" testId="chess-puzzle-progress">
          <StatPill
            icon={FlameIcon}
            value={progress().streak}
            label={<Trans>in a row</Trans>}
            active={progress().streak > 0}
            dataSet={{ testid: 'chess-puzzle-streak' }}
          />
          <StatPill
            icon={CircleCheckIcon}
            value={progress().solved}
            label={<Trans>solved</Trans>}
            dataSet={{ testid: 'chess-puzzle-solved-count' }}
          />
        </StackHorizontal>
      )}
    </Show>
  );
}

/**
 * Puzzle play, presentational: the feed strip, the coach with the status
 * row, the board well, the move list with its review controls and the
 * action row (help, retry or next, then Skip puzzle) — beside the board in
 * one panel card when wide — for a placed puzzle, a pending pick, or
 * why none can be placed. On a phone only the prompt (the coach and whose
 * move it is) sits over the board, so the board starts near the top; the
 * feed's settings line, secondary there, follows the actions. The board,
 * the feed and the overlays arrive as slots; `PuzzlePlayScreen` wires the
 * room.
 */
export function PuzzlePlayScreenView(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  const boardMeasure = createMeasure();
  const playing = (): boolean => props.pick === 'playing';
  const mode = useLayoutMode();
  const feedAbove = (): boolean => !props.spectator && mode() === 'wide';
  const feedBelow = (): boolean => !props.spectator && mode() !== 'wide';
  return (
    <StackVertical grow self="stretch" testId="chess-puzzle-play-screen">
      <Show when={playing()}>{props.probe}</Show>
      <PuzzleScreen
        screenId="chess-puzzle-play"
        boardSizing={props.boardSizing}
        title={<Trans>Puzzles</Trans>}
        facts={
          <Show when={!props.spectator}>
            <PlayProgress progress={props.progress} />
          </Show>
        }
        dataSet={{ testid: 'chess-puzzle-play-layout' }}
        header={
          <>
            <Show when={feedAbove()}>{props.feed}</Show>
            <Show when={props.spectator}>
              <SpectatorAllowance label={props.allowanceLabel} />
            </Show>
            <PlayAssistant {...props} />
          </>
        }
        overlay={
          <>
            <Show when={!playing()}>{props.probe}</Show>
            {props.overlay}
          </>
        }
        legend={props.legend}
        timeline={props.timeline}
        actions={
          <Show when={!props.spectator}>
            <StackVertical gap="md">
              <PlayActions {...props} />
              <Show when={feedBelow()}>{props.feed}</Show>
            </StackVertical>
          </Show>
        }
      >
        <Show
          when={props.boardSizing === 'width'}
          fallback={
            <BoardFit testId={Handles.chessPuzzleBoardFrame}>
              {(size) => <BoardWell view={props} size={size} />}
            </BoardFit>
          }
        >
          <StackVertical
            self="stretch"
            measureTarget={boardMeasure.target}
            testId={Handles.chessPuzzleBoardFrame}
          >
            <BoardWell view={props} size={boardMeasure.width()} />
          </StackVertical>
        </Show>
      </PuzzleScreen>
    </StackVertical>
  );
}
