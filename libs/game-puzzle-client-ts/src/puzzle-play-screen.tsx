import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { PUZZLE_PIECE_MOVE_MS } from '@libs/game-puzzle-shared-ts/opponent-stage';
import type { PuzzlePickState } from '@libs/game-puzzle-shared-ts/pick-state';
import { lineActions } from '@libs/game-puzzle-shared-ts/step';
import {
  DefineBackButton,
  useGameChoicesName,
} from '@libs/spaces-client-ts/spaces-nav-context';
import { t } from '@lingui/core/macro';
import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import { useSoundsPreference } from '@pkgs/sounds-client-ts/solid';
import { createSpeak } from '@pkgs/tts-root-client-ts/solid';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import { puzzleLineLayout } from '@pkgs/turn-game-shared-ts/game-puzzles';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { type Accessor, createMemo, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { usePuzzleGame } from './puzzle-game-context';
import { PuzzleMoveHistoryBar } from './puzzle-move-history-bar';
import {
  CelebrationLayer,
  PuzzlePlayFeed,
  useFeedSettingsOverlay,
} from './puzzle-play-overlays';
import {
  type PuzzlePlayPick,
  PuzzlePlayScreenView,
} from './puzzle-play-screen-view';
import { PuzzleRecommendationLegend } from './puzzle-recommendation-legend';
import { PuzzleResultAnnouncement } from './puzzle-result-announcement';
import { PuzzleShareLink } from './puzzle-share-link';
import { PuzzleTestLoadingStatus } from './puzzle-test-loading-status';
import { PuzzleTestProbes } from './puzzle-test-probes';
import { useDeniedView } from './use-denied-view';
import { usePuzzleAllowance } from './use-puzzle-allowance';
import { usePuzzleFeedConfig } from './use-puzzle-feed-config';
import { usePuzzleHistory } from './use-puzzle-history';
import { usePuzzlePlayScreenState } from './use-puzzle-play-screen-state';
import type { PuzzlePlayerChromeModel } from './use-puzzle-player-state';
import { usePuzzlePlayerState } from './use-puzzle-player-state';

const noop = (): void => {};

/** The game's board, in play: the room's position, its marks and suggestions. */
function PuzzlePlayerBoardSlot(props: {
  size: number;
  p: PuzzlePlayerChromeModel;
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
          p.status() === 'solving' && p.atFrontier() && !p.opponentAnimating()
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

/** The solver's own run so far; nothing for a spectator. */
function usePlayProgress(p: PuzzlePlayerChromeModel) {
  const history = usePuzzleHistory();
  return () =>
    p.isSpectator()
      ? undefined
      : {
          streak: history.stats().currentStreak,
          solved: history.stats().totalSolved,
        };
}

function PuzzlePlayerChrome(props: {
  model: PuzzlePlayerChromeModel;
  probe: JSX.Element;
  onFeedConfigApplied: () => void;
}): JSX.Element {
  const p = props.model;
  const myId = useMyId();
  const allowance = usePuzzleAllowance();
  const [config] = usePuzzleFeedConfig();
  const feedSettings = useFeedSettingsOverlay(props.onFeedConfigApplied);
  const choices = useGameChoicesName();
  const progress = usePlayProgress(p);
  const correct = useCorrectSoFar(p);
  const solverSide = useSolverSide(p);
  return (
    <>
      <DefineBackButton onPress={p.backToRoot} label={choices()} />
      <PuzzlePlayScreenView
        pick="playing"
        statusKind={p.statusKind()}
        solverSide={solverSide()}
        correct={correct()}
        coach={{
          message: p.coach()?.text ?? '',
          contextKey: p.coach()?.positionKey ?? '',
          handles: {
            observation: p.coach()?.kind ?? '',
            purpose: p.coach()?.purpose ?? '',
            puzzleId: p.coach()?.puzzleId ?? '',
          },
        }}
        speaker={createSpeak}
        elapsedMs={p.clockElapsedMs()}
        spectator={p.isSpectator()}
        allowanceLabel={allowance.label()}
        progress={progress()}
        shareLink={
          <Show when={p.puzzleId()} keyed>
            {(puzzleId) => <PuzzleShareLink puzzleId={puzzleId} />}
          </Show>
        }
        feed={
          <PuzzlePlayFeed
            puzzleId={p.puzzleId()}
            rating={p.rating()}
            themes={p.themes()}
            status={p.status()}
            onOpenFeedSettings={feedSettings.open}
          />
        }
        legend={
          <PuzzleRecommendationLegend
            entries={p.recommendationEntries}
            colorFor={p.recommendationColorFor}
            myId={myId()}
            onClearMine={p.onClearMyRecommendation}
          />
        }
        timeline={<PuzzleMoveHistoryBar />}
        board={(size) => <PuzzlePlayerBoardSlot size={size} p={p} />}
        feedConfig={config()}
        status={p.status()}
        hintStage={p.hintStage()}
        canGoForward={p.canGoForward()}
        onHint={p.onHint}
        onSolution={p.onSolution}
        onRetry={p.onRetry}
        onSkip={p.onSkip}
        onNext={p.onNext}
        onIncludeAllPuzzles={noop}
        onOpenFeedSettings={feedSettings.open}
        probe={props.probe}
        overlay={
          <>
            <PuzzleCompanion p={p} />
            <CelebrationLayer
              completion={p.completion}
              status={p.status}
              onNext={p.onNext}
            />
            {feedSettings.modal()}
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

type ShellPickState = Exclude<PuzzlePickState, 'ready'>;

function shellCoachLine(state: ShellPickState): string {
  switch (state) {
    case 'loading':
      return '';
    case 'offline':
      return t`I can't fetch puzzles without a connection. Come back online and we'll pick up here.`;
    case 'limited':
      return t`That's all the puzzles for now. The board opens again when your allowance resets.`;
    case 'empty':
      return t`You've cleared everything in your feed. Widen the filters and let's keep going.`;
    case 'waiting':
      return t`Waiting for the host to start a puzzle.`;
  }
}

/** Play chrome without a placed puzzle: loading, offline, limited or empty. */
function PuzzlePlayShell(props: {
  backToRoot: () => void;
  pickState: Accessor<ShellPickState>;
  testLoadingStatus: JSX.Element;
  onFeedConfigApplied: () => void;
  includeAllPuzzles: () => void;
  startDenial: Accessor<Decision | null>;
}): JSX.Element {
  const [config] = usePuzzleFeedConfig();
  const feedSettings = useFeedSettingsOverlay(props.onFeedConfigApplied);
  const choices = useGameChoicesName();
  const denial = useDeniedView({
    get decision() {
      return props.startDenial();
    },
    testId: 'chess-puzzle-limit',
  });
  const pick = (): PuzzlePlayPick => props.pickState();
  return (
    <>
      <DefineBackButton onPress={props.backToRoot} label={choices()} />
      <PuzzlePlayScreenView
        pick={pick()}
        statusKind={props.pickState()}
        coach={{ message: shellCoachLine(props.pickState()) }}
        coachResolving={props.pickState() === 'loading'}
        elapsedMs={null}
        spectator={false}
        allowanceLabel=""
        feed={
          <PuzzlePlayFeed
            status="loading"
            onOpenFeedSettings={feedSettings.open}
          />
        }
        timeline={<PuzzleMoveHistoryBar />}
        feedConfig={config()}
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
        onOpenFeedSettings={feedSettings.open}
        probe={props.testLoadingStatus}
        overlay={feedSettings.modal()}
      />
    </>
  );
}

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
  const shellState = createMemo<ShellPickState>(() => {
    const state = pickState();
    return state === 'ready' ? 'loading' : state;
  });

  return (
    <Show
      when={activePuzzleId() !== null}
      fallback={
        <PuzzlePlayShell
          backToRoot={backToRoot}
          pickState={shellState}
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
