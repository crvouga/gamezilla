import { useMyId } from '@libs/auth/public/use-current-user';
import { t } from '@lingui/core/macro';
import { SpeakingAvatarAssistant } from '@pkgs/assistant/client';
import { SmartChessBoard } from '@pkgs/chess-board/smart-chess-board';
import type { Move } from '@pkgs/chess-board/smart-chess-board-types';
import {
  SpeakingAvatar,
  SpectatorIndicator,
  useLayoutMode,
  useRouter,
} from '@pkgs/ui';
import { type Accessor, createMemo, type JSX, Show } from 'solid-js';

import type { HintStage } from '../../shared/puzzle-session/hint-stage';
import type { PuzzlePickState } from '../../shared/puzzle-session/pick-state';
import type { ChessPuzzleStatusKind } from '../../shared/puzzle-session/status-kind';
import { ChessPuzzleBoardLoadingState } from './chess-puzzle-board-loading-state';
import { ChessPuzzleClock } from './chess-puzzle-clock';
import { ChessPuzzleE2EHints } from './chess-puzzle-e2e-hints';
import { ChessPuzzleE2ELoadingStatus } from './chess-puzzle-e2e-loading-status';
import { ChessPuzzleEmptyPoolState } from './chess-puzzle-empty-pool-state';
import {
  type PuzzlePlayBoardChrome,
  PuzzlePlayLayout,
} from './chess-puzzle-play-layout';
import { ChessPuzzleRecommendationLegend } from './chess-puzzle-recommendation-legend';
import { ChessPuzzleStatusHeader } from './chess-puzzle-status-header';
import { useChessPuzzleFeedConfig } from './use-chess-puzzle-feed-config';
import type { SolveStatus } from './use-chess-puzzle-solver';
import { usePuzzlePlayScreenState } from './use-puzzle-play-screen-state';
import {
  type PuzzlePlayerChromeModel,
  usePuzzlePlayerState,
} from './use-puzzle-player-state';

const LOADING_SHELL_STATUS = 'loading' as const satisfies SolveStatus;
const LOADING_SHELL_HINT_STAGE = 'none' as const satisfies HintStage;
const COMPACT_AVATAR_SIZE = 56;
const WIDE_AVATAR_SIZE = 80;
const BILLING_ROUTE = '/more/billing';

const noop = (): void => {};

function usePuzzleAvatarSize(): () => number {
  const mode = useLayoutMode();
  return () => (mode() === 'wide' ? WIDE_AVATAR_SIZE : COMPACT_AVATAR_SIZE);
}

function PuzzleBoardSlot(props: {
  size: number;
  displayFen: Accessor<string | null>;
  layoutKey: Accessor<number>;
  recommendBump: Accessor<number>;
  orientation: Accessor<'white' | 'black'>;
  status: Accessor<SolveStatus>;
  atFrontier: Accessor<boolean>;
  opponentAnimating: Accessor<boolean>;
  spectator: Accessor<boolean>;
  onMove: (m: Move) => void;
  cellFeedback: PuzzlePlayerChromeModel['cellFeedback'];
  cellHighlights: PuzzlePlayerChromeModel['cellHighlights'];
  arrows: PuzzlePlayerChromeModel['arrows'];
  recommendationArrows: PuzzlePlayerChromeModel['recommendationArrows'];
}): JSX.Element {
  return (
    <Show
      when={props.displayFen() !== null && props.displayFen()!.length > 0}
      fallback={<ChessPuzzleBoardLoadingState size={props.size} />}
    >
      <SmartChessBoard
        dataSet={{ testid: 'chess-puzzle-board' }}
        size={props.size}
        fen={props.displayFen() ?? ''}
        fenSyncKey={props.layoutKey() + props.recommendBump()}
        orientation={props.orientation()}
        interactive={
          props.status() === 'solving' &&
          props.atFrontier() &&
          !props.opponentAnimating()
        }
        onMove={props.onMove}
        showCoordinates
        highlightLastMove
        highlightLegalMoves
        cellFeedback={props.cellFeedback()}
        cellHighlights={props.cellHighlights()}
        arrows={[...props.arrows(), ...props.recommendationArrows()]}
      />
    </Show>
  );
}

function PuzzlePlayerBoardSlot(props: {
  size: number;
  p: PuzzlePlayerChromeModel;
}): JSX.Element {
  const p = props.p;
  return (
    <PuzzleBoardSlot
      size={props.size}
      displayFen={p.displayFen}
      layoutKey={p.layoutKey}
      recommendBump={p.recommendBump}
      orientation={p.orientation}
      status={p.status}
      atFrontier={p.atFrontier}
      opponentAnimating={p.opponentAnimating}
      spectator={p.isSpectator}
      onMove={(m) => (p.isSpectator() ? p.onRecommendMove(m) : p.onMove(m))}
      cellFeedback={p.cellFeedback}
      cellHighlights={p.cellHighlights}
      arrows={p.arrows}
      recommendationArrows={p.recommendationArrows}
    />
  );
}

function PuzzlePlayerE2eHints(props: {
  p: PuzzlePlayerChromeModel;
}): JSX.Element {
  const p = props.p;
  const statusKind = (): ChessPuzzleStatusKind => p.statusKind();
  return (
    <ChessPuzzleE2EHints
      orientation={p.orientation}
      status={p.status}
      solveIdx={p.solveIdx}
      moves={p.movesStr}
      interactive={() =>
        !p.isSpectator() &&
        p.status() === 'solving' &&
        p.atFrontier() &&
        !p.opponentAnimating()
      }
      solutionUci={p.solutionUci}
      expectedFromSquare={p.expectedFromSquare}
      expectedToSquare={p.expectedToSquare}
      hintStage={p.hintStage}
      displayFen={p.displayFen}
      spectating={p.isSpectator}
      spaceRole={p.spaceRole}
      statusKind={statusKind}
      clockElapsedMs={p.clockElapsedMs}
      recommendations={p.recommendationProbe}
    />
  );
}

function PuzzlePlayerChrome(props: {
  model: PuzzlePlayerChromeModel;
  onFeedConfigApplied: () => void;
}): JSX.Element {
  const p = props.model;
  const myId = useMyId();
  const avatarSize = usePuzzleAvatarSize();
  const statusKind = (): ChessPuzzleStatusKind => p.statusKind();
  return (
    <PuzzlePlayLayout
      backToRoot={p.backToRoot}
      puzzleId={p.puzzleId()}
      puzzleRating={p.rating()}
      spectator={p.isSpectator}
      assistant={
        <SpeakingAvatarAssistant
          assistant={p.assistant()}
          header={
            <ChessPuzzleStatusHeader
              kind={statusKind()}
              sideToMove={p.orientation()}
              trailing={
                <>
                  <ChessPuzzleClock elapsedMs={p.clockElapsedMs} />
                  <Show when={p.isSpectator()}>
                    <SpectatorIndicator />
                  </Show>
                </>
              }
            />
          }
          numberOfLines={2}
          avatarSize={avatarSize()}
        />
      }
      recommendationLegend={
        <ChessPuzzleRecommendationLegend
          entries={p.recommendationEntries}
          colorFor={p.recommendationColorFor}
          myId={myId()}
          onClearMine={p.onClearMyRecommendation}
        />
      }
      boardSlot={(size) => <PuzzlePlayerBoardSlot size={size} p={p} />}
      status={p.status}
      hintStage={p.hintStage}
      canGoBack={p.canGoBack}
      canGoForward={p.canGoForward}
      onHint={p.onHint}
      onSolution={p.onSolution}
      onBack={p.onBack}
      onForward={p.onForward}
      onRetry={p.onRetry}
      onSkip={p.onSkip}
      onNext={p.onNext}
      onFeedConfigApplied={props.onFeedConfigApplied}
      completion={p.completion}
      e2eHints={<PuzzlePlayerE2eHints p={p} />}
    />
  );
}

type PuzzlePlayerProps = {
  puzzleId: string;
  playGeneration: number;
  readyGeneration: number;
  startNonce: number;
  onRequestNext: () => void;
  onFeedConfigApplied: () => void;
};

function PuzzlePlayer(props: PuzzlePlayerProps): JSX.Element {
  const p = usePuzzlePlayerState({
    puzzleId: () => props.puzzleId,
    playGeneration: () => props.playGeneration,
    readyGeneration: () => props.readyGeneration,
    startNonce: () => props.startNonce,
    onRequestNext: props.onRequestNext,
  });
  return (
    <PuzzlePlayerChrome
      model={p}
      onFeedConfigApplied={props.onFeedConfigApplied}
    />
  );
}
type ShellPickState = Exclude<PuzzlePickState, 'ready'>;
type ShellBoardPickState = Exclude<ShellPickState, 'loading'>;

function shellHeaderKind(state: ShellPickState): ChessPuzzleStatusKind {
  return state;
}

function shellCoachLine(state: ShellPickState): string {
  switch (state) {
    case 'loading':
      return '';
    case 'offline':
      return t`I can't fetch puzzles without a connection. Come back online and we'll pick up here.`;
    case 'limited':
      return t`You've used today's puzzles. Upgrade for unlimited play, or come back tomorrow.`;
    case 'empty':
      return t`You've cleared everything in your feed. Widen the filters and let's keep going.`;
    case 'waiting':
      return t`Waiting for the host to start a puzzle.`;
  }
}

function ShellBoardSlot(props: {
  size: number;
  chrome: PuzzlePlayBoardChrome;
  pickState: ShellBoardPickState;
  includeAllPuzzles: () => void;
  onUpgrade: () => void;
}): JSX.Element {
  const [config] = useChessPuzzleFeedConfig();
  return (
    <ChessPuzzleEmptyPoolState
      kind={props.pickState}
      size={props.size}
      config={config()}
      onIncludeAllPuzzles={props.includeAllPuzzles}
      onOpenFeedSettings={props.chrome.openFeedSettings}
      onUpgrade={props.onUpgrade}
    />
  );
}

/** Play chrome without a placed puzzle: loading, offline, limited or empty. */
function PuzzlePlayShell(props: {
  backToChessRoot: () => void;
  pickState: Accessor<ShellPickState>;
  e2eLoadingStatus: JSX.Element;
  onFeedConfigApplied: () => void;
  includeAllPuzzles: () => void;
  onUpgrade: () => void;
}): JSX.Element {
  const avatarSize = usePuzzleAvatarSize();
  const boardKind = createMemo<ShellBoardPickState | null>(() => {
    const state = props.pickState();
    return state === 'loading' ? null : state;
  });
  return (
    <PuzzlePlayLayout
      backToRoot={props.backToChessRoot}
      e2eLoadingStatus={props.e2eLoadingStatus}
      assistant={
        <SpeakingAvatar
          message={shellCoachLine(props.pickState())}
          bubbleResolving={props.pickState() === 'loading'}
          header={
            <ChessPuzzleStatusHeader
              kind={shellHeaderKind(props.pickState())}
            />
          }
          numberOfLines={2}
          avatarSize={avatarSize()}
        />
      }
      boardSlot={(size, chrome) => (
        <Show
          when={boardKind()}
          keyed
          fallback={<ChessPuzzleBoardLoadingState size={size} />}
        >
          {(kind) => (
            <ShellBoardSlot
              size={size}
              chrome={chrome}
              pickState={kind}
              includeAllPuzzles={props.includeAllPuzzles}
              onUpgrade={props.onUpgrade}
            />
          )}
        </Show>
      )}
      status={() => LOADING_SHELL_STATUS}
      hintStage={() => LOADING_SHELL_HINT_STAGE}
      canGoBack={() => false}
      canGoForward={() => false}
      onHint={noop}
      onSolution={noop}
      onBack={noop}
      onForward={noop}
      onRetry={noop}
      onSkip={noop}
      onNext={noop}
      onFeedConfigApplied={props.onFeedConfigApplied}
      completion={() => null}
      spectator={() => false}
    />
  );
}

export function PuzzlePlayScreen(): JSX.Element {
  const {
    backToChessRoot,
    activePuzzleId,
    pickState,
    attemptSeed,
    readyGeneration,
    startNonce,
    onRequestNext,
    reselectActivePuzzleFromFeed,
    includeAllPuzzles,
    e2eLoadingStatus,
  } = usePuzzlePlayScreenState();

  const e2ePickStatus = <ChessPuzzleE2ELoadingStatus {...e2eLoadingStatus()} />;
  const router = useRouter();
  const shellState = createMemo<ShellPickState>(() => {
    const state = pickState();
    return state === 'ready' ? 'loading' : state;
  });
  const openBilling = (): void => {
    router.push(BILLING_ROUTE);
  };

  return (
    <div
      class="box flex-1 min-h-[0] self-stretch"
      data-testid="chess-puzzle-play-screen"
    >
      <Show
        when={activePuzzleId() !== null}
        fallback={
          <PuzzlePlayShell
            backToChessRoot={backToChessRoot}
            pickState={shellState}
            e2eLoadingStatus={e2ePickStatus}
            onFeedConfigApplied={reselectActivePuzzleFromFeed}
            includeAllPuzzles={includeAllPuzzles}
            onUpgrade={openBilling}
          />
        }
      >
        {e2ePickStatus}
        <PuzzlePlayer
          puzzleId={activePuzzleId()!}
          playGeneration={attemptSeed()}
          readyGeneration={readyGeneration()}
          startNonce={startNonce()}
          onRequestNext={onRequestNext}
          onFeedConfigApplied={reselectActivePuzzleFromFeed}
        />
      </Show>
    </div>
  );
}
