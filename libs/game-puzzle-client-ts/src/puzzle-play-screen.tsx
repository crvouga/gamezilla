import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { PUZZLE_PIECE_MOVE_MS } from '@libs/game-puzzle-shared-ts/opponent-stage';
import type { PuzzlePickState } from '@libs/game-puzzle-shared-ts/pick-state';
import { lineActions } from '@libs/game-puzzle-shared-ts/step';
import { useSoundsPreference } from '@pkgs/sounds-client-ts/solid';
import { createSpeak } from '@pkgs/tts-root-client-ts/solid';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import { puzzleLineLayout } from '@pkgs/turn-game-shared-ts/game-puzzles';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { type Accessor, createMemo, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { PuzzleFeedRefusedChangeNotice } from './puzzle-feed-refused-change-notice';
import { usePuzzleGame } from './puzzle-game-context';
import {
  type PuzzlePlayPick,
  type PuzzlePlayStage,
  puzzlePlayStageOf,
} from './puzzle-play-places';
import {
  NO_PUZZLE_LINE,
  NO_PUZZLE_RESULT,
  PuzzlePlaceBack,
  usePuzzlePlayPlaces,
} from './puzzle-play-places-wiring';
import { PuzzlePlayScreenView } from './puzzle-play-screen-view';
import { PuzzleRecommendationLegend } from './puzzle-recommendation-legend';
import { PuzzleResultAnnouncement } from './puzzle-result-announcement';
import { PuzzleTestLoadingStatus } from './puzzle-test-loading-status';
import { PuzzleTestProbes } from './puzzle-test-probes';
import { useDeniedView } from './use-denied-view';
import { usePuzzleAllowance } from './use-puzzle-allowance';
import { usePuzzleLine } from './use-puzzle-line';
import { usePuzzlePlayScreenState } from './use-puzzle-play-screen-state';
import type { PuzzlePlayerChromeModel } from './use-puzzle-player-state';
import { usePuzzlePlayerState } from './use-puzzle-player-state';
import { PuzzleResultFeedback, usePuzzleResult } from './use-puzzle-result';
import { PuzzleShareAnnouncement, usePuzzleShare } from './use-puzzle-share';

const noop = (): void => {};

/**
 * The game's board with the room's position, its marks and suggestions. It
 * takes moves only on the board's own screen (`live`), while the solver is
 * to move at the latest position.
 */
function PuzzlePlayerBoardSlot(props: {
  size: number;
  p: PuzzlePlayerChromeModel;
  live: boolean;
}): JSX.Element {
  const sounds = useSoundsPreference();
  const { client } = usePuzzleGame();
  const p = props.p;
  return (
    <Show
      when={p.boardPosition() !== null && p.boardPosition()!.length > 0}
      fallback={<LoadingState size="lg" />}
    >
      <Dynamic
        component={client.Board}
        mode="play"
        testId="chess-puzzle-board"
        size={props.size}
        position={p.boardPosition() ?? ''}
        orientation={p.orientation()}
        interactive={
          props.live &&
          p.status() === 'solving' &&
          p.atFrontier() &&
          !p.opponentAnimating()
        }
        sound={!sounds.muted()}
        setup={null}
        hand={null}
        committed={[]}
        commitment={null}
        syncKey={p.layoutKey() + p.recommendBump()}
        animated
        moveMs={PUZZLE_PIECE_MOVE_MS}
        marks={p.marks()}
        suggestions={p.suggestions()}
        lastAction={
          p.atFrontier()
            ? (lineActions(p.attempt.line())[p.attempt.solveIdx() - 1] ?? null)
            : null
        }
        onAction={(action: string) =>
          p.isSpectator() ? p.onRecommendAction(action) : p.onMove(action)
        }
      />
    </Show>
  );
}

/**
 * The attempt's probes, its results said for someone listening, and the
 * game's own companion to it.
 */
function PuzzleCompanion(props: { p: PuzzlePlayerChromeModel }): JSX.Element {
  const { client } = usePuzzleGame();
  return (
    <>
      <PuzzleTestProbes attempt={props.p.attempt} />
      <PuzzleResultAnnouncement attempt={props.p.attempt} />
      <Show when={client.Companion} keyed>
        {(Companion) => <Companion attempt={props.p.attempt} />}
      </Show>
    </>
  );
}

/** The solver's side as the game names it, once a position is shown. */
function useSolverSide(p: PuzzlePlayerChromeModel): () => string | null {
  const presentation = useGamePresentation();
  return () => {
    const position = p.boardPosition();
    return position === null || position.length === 0
      ? null
      : presentation(position).sideLabel(p.orientation());
  };
}

/**
 * The solver has played at least one right move of the line and is to
 * move again: past the line's first solver move, still solving.
 */
function useCorrectSoFar(p: PuzzlePlayerChromeModel): () => boolean {
  const firstSolveIdx = puzzleLineLayout(usePuzzleGame().game.puzzles).start;
  return () => p.status() === 'solving' && p.attempt.solveIdx() > firstSolveIdx;
}

/** The coach's line and its spec handles, as the status line takes them. */
function coachOf(p: PuzzlePlayerChromeModel) {
  return {
    message: p.coach()?.text ?? '',
    contextKey: p.coach()?.positionKey ?? '',
    handles: {
      observation: p.coach()?.kind ?? '',
      purpose: p.coach()?.purpose ?? '',
      puzzleId: p.coach()?.puzzleId ?? '',
    },
  };
}

function PuzzlePlayerChrome(props: {
  model: PuzzlePlayerChromeModel;
  probe: JSX.Element;
  onFeedConfigApplied: () => void;
}): JSX.Element {
  const p = props.model;
  const puzzleGame = usePuzzleGame();
  const myId = useMyId();
  const allowance = usePuzzleAllowance();
  const line = usePuzzleLine();
  const stage = createMemo<PuzzlePlayStage>(() =>
    puzzlePlayStageOf({
      pick: 'playing',
      status: p.status(),
      spectator: p.isSpectator(),
    })
  );
  const places = usePuzzlePlayPlaces({
    stage,
    leave: p.backToRoot,
    onFeedConfigApplied: props.onFeedConfigApplied,
  });
  const result = usePuzzleResult(p);
  const share = usePuzzleShare(() => (p.isSpectator() ? null : p.puzzleId()));
  const correct = useCorrectSoFar(p);
  const solverSide = useSolverSide(p);
  return (
    <>
      <PuzzlePlaceBack places={places} />
      <PuzzlePlayScreenView
        stage={stage()}
        place={places.nav.place()}
        onOpen={places.nav.open}
        onBack={places.back}
        boardSizing={puzzleGame.client.boardSizing}
        statusKind={p.statusKind()}
        solverSide={solverSide()}
        correct={correct()}
        coach={coachOf(p)}
        speaker={createSpeak}
        elapsedMs={p.clockElapsedMs()}
        spectator={p.isSpectator()}
        allowanceLabel={allowance.label()}
        ratingChange={result.ratingChange()}
        legend={
          <PuzzleRecommendationLegend
            entries={p.recommendationEntries}
            colorFor={p.recommendationColorFor}
            myId={myId()}
            onClearMine={p.onClearMyRecommendation}
          />
        }
        board={(size) => (
          <PuzzlePlayerBoardSlot
            size={size}
            p={p}
            live={places.nav.place().screen !== 'line'}
          />
        )}
        line={line()}
        status={p.status()}
        hintStage={p.hintStage()}
        canGoForward={p.canGoForward()}
        onHint={p.onHint}
        onSolution={p.onSolution}
        onRetry={p.onRetry}
        onSkip={p.onSkip}
        onNext={p.onNext}
        onIncludeAllPuzzles={noop}
        feed={places.feed()}
        result={result.model()}
        share={share()}
        notices={<PuzzleFeedRefusedChangeNotice />}
        probe={props.probe}
        overlay={
          <>
            <PuzzleCompanion p={p} />
            <PuzzleResultFeedback model={p} />
            <PuzzleShareAnnouncement share={share()} />
          </>
        }
      />
    </>
  );
}

type PuzzlePlayerProps = {
  puzzleId: string;
  playGeneration: number;
  readyGeneration: number;
  startNonce: number;
  onRequestNext: () => void;
  onFeedConfigApplied: () => void;
  /** The test-only pick probe, beside the player. */
  probe: JSX.Element;
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
      probe={props.probe}
      onFeedConfigApplied={props.onFeedConfigApplied}
    />
  );
}

type ShellPick = Exclude<PuzzlePlayPick, 'playing'>;

/** The feed without a placed puzzle: loading, offline, limited, empty, waiting. */
function PuzzlePlayShell(props: {
  backToRoot: () => void;
  pick: Accessor<ShellPick>;
  testLoadingStatus: JSX.Element;
  onFeedConfigApplied: () => void;
  includeAllPuzzles: () => void;
  startDenial: ReturnType<typeof usePuzzlePlayScreenState>['startDenial'];
}): JSX.Element {
  const allowance = usePuzzleAllowance();
  const stage = createMemo<PuzzlePlayStage>(() =>
    puzzlePlayStageOf({
      pick: props.pick(),
      status: 'loading',
      spectator: false,
    })
  );
  const places = usePuzzlePlayPlaces({
    stage,
    leave: props.backToRoot,
    onFeedConfigApplied: props.onFeedConfigApplied,
  });
  const denial = useDeniedView({
    get decision() {
      return props.startDenial();
    },
    testId: 'chess-puzzle-limit',
  });
  return (
    <>
      <PuzzlePlaceBack places={places} />
      <PuzzlePlayScreenView
        stage={stage()}
        place={places.nav.place()}
        onOpen={places.nav.open}
        onBack={places.back}
        statusKind={props.pick()}
        coach={{ message: '' }}
        elapsedMs={null}
        spectator={props.pick() === 'waiting'}
        allowanceLabel={allowance.label()}
        ratingChange={null}
        line={NO_PUZZLE_LINE}
        denial={denial()}
        status="loading"
        hintStage="none"
        canGoForward={false}
        onHint={noop}
        onSolution={noop}
        onRetry={noop}
        onSkip={noop}
        onNext={noop}
        onIncludeAllPuzzles={props.includeAllPuzzles}
        feed={places.feed()}
        result={NO_PUZZLE_RESULT}
        share={null}
        notices={<PuzzleFeedRefusedChangeNotice />}
        probe={props.testLoadingStatus}
      />
    </>
  );
}

/** Without a placed puzzle a ready pick is still being placed: loading. */
function shellPickOf(state: PuzzlePickState): ShellPick {
  return state === 'ready' ? 'loading' : state;
}

/**
 * The puzzle feed's screen in a space: the place machine's stage from the
 * feed's pick and the attempt in the room, its place from what this device
 * opened, and one back control that steps back through the places before
 * leaving for the game's choices.
 */
export function PuzzlePlayScreen(): JSX.Element {
  const {
    backToRoot,
    activePuzzleId,
    pickState,
    attemptSeed,
    readyGeneration,
    startNonce,
    onRequestNext,
    reselectActivePuzzleFromFeed,
    includeAllPuzzles,
    testLoadingStatus,
    startDenial,
  } = usePuzzlePlayScreenState();

  const testPickStatus = <PuzzleTestLoadingStatus {...testLoadingStatus()} />;
  const shellPick = createMemo<ShellPick>(() => shellPickOf(pickState()));

  return (
    <Show
      when={activePuzzleId() !== null}
      fallback={
        <PuzzlePlayShell
          backToRoot={backToRoot}
          pick={shellPick}
          testLoadingStatus={testPickStatus}
          onFeedConfigApplied={reselectActivePuzzleFromFeed}
          includeAllPuzzles={includeAllPuzzles}
          startDenial={startDenial}
        />
      }
    >
      <PuzzlePlayer
        puzzleId={activePuzzleId()!}
        playGeneration={attemptSeed()}
        readyGeneration={readyGeneration()}
        startNonce={startNonce()}
        onRequestNext={onRequestNext}
        onFeedConfigApplied={reselectActivePuzzleFromFeed}
        probe={testPickStatus}
      />
    </Show>
  );
}
