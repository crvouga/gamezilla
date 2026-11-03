import type { PuzzleFeedConfig } from '@libs/game-puzzle-shared-ts/feed-config';
import type { HintStage } from '@libs/game-puzzle-shared-ts/hint-stage';
import type { SolveStatus } from '@libs/game-puzzle-shared-ts/solve-status';
import type { PuzzleStatusKind } from '@libs/game-puzzle-shared-ts/status-kind';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { BoardFit } from '@pkgs/ui-root-client-ts/board-fit';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { PuzzleScreen } from '@pkgs/ui-root-client-ts/puzzle-screen';
import {
  SpeakingAvatar,
  type SpeakingAvatarSpeaker,
} from '@pkgs/ui-root-client-ts/speaking-avatar';
import { SpectatorIndicator } from '@pkgs/ui-root-client-ts/spectator-indicator';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { PuzzleActionBar } from './puzzle-action-bar';
import { PuzzleClockLabel } from './puzzle-clock-label';
import { PuzzleEmptyPoolState } from './puzzle-empty-pool-state';
import { PuzzleStatusHeader } from './puzzle-status-header';

const COMPACT_AVATAR_SIZE = 56;
const WIDE_AVATAR_SIZE = 80;

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
  readonly statusKind: PuzzleStatusKind;
  /** The solver's side as the game names it, once a position is shown. */
  readonly solverSide?: string | null | undefined;
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
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly onHint: () => void;
  readonly onSolution: () => void;
  readonly onBack: () => void;
  readonly onForward: () => void;
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

function useAvatarSize(): () => number {
  const mode = useLayoutMode();
  return () => (mode() === 'wide' ? WIDE_AVATAR_SIZE : COMPACT_AVATAR_SIZE);
}

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
  const avatarSize = useAvatarSize();
  const handles = () => props.coach.handles;
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
          solverSide={props.solverSide ?? null}
          trailing={
            <Show when={props.pick === 'playing'}>
              <HeaderTrailing {...props} />
            </Show>
          }
        />
      }
      numberOfLines={2}
      avatarSize={avatarSize()}
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

function PlayActions(props: PuzzlePlayScreenViewProps): JSX.Element {
  return (
    <PuzzleActionBar
      status={props.status}
      hintStage={props.hintStage}
      canGoBack={props.canGoBack}
      canGoForward={props.canGoForward}
      onHint={props.onHint}
      onSolution={props.onSolution}
      onBack={props.onBack}
      onForward={props.onForward}
      onRetry={props.onRetry}
      onSkip={props.onSkip}
      onNext={props.onNext}
    />
  );
}

/**
 * Puzzle play, presentational: the feed strip, the coach with the status
 * row, the board well, the move list and the action bar — for a placed
 * puzzle, a pending pick, or why none can be placed. The board, the feed
 * and the overlays arrive as slots; `PuzzlePlayScreen` wires the room.
 */
export function PuzzlePlayScreenView(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  const playing = (): boolean => props.pick === 'playing';
  return (
    <StackVertical grow self="stretch" testId="chess-puzzle-play-screen">
      <Show when={playing()}>{props.probe}</Show>
      <PuzzleScreen
        screenId="chess-puzzle-play"
        dataSet={{ testid: 'chess-puzzle-play-layout' }}
        header={
          <>
            <Show when={!props.spectator}>{props.feed}</Show>
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
            <PlayActions {...props} />
          </Show>
        }
      >
        <BoardFit testId={Handles.chessPuzzleBoardFrame}>
          {(size) => <BoardWell view={props} size={size} />}
        </BoardFit>
      </PuzzleScreen>
    </StackVertical>
  );
}
