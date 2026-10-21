import { useMyId } from '@libs/auth-client/use-current-user';
import type { HintStage } from '@libs/game-puzzle-shared/hint-stage';
import { PUZZLE_PIECE_MOVE_MS } from '@libs/game-puzzle-shared/opponent-stage';
import type { PuzzlePickState } from '@libs/game-puzzle-shared/pick-state';
import type { SolveStatus } from '@libs/game-puzzle-shared/solve-status';
import type { PuzzleStatusKind } from '@libs/game-puzzle-shared/status-kind';
import { t } from '@lingui/core/macro';
import type { Decision } from '@pkgs/permissions-shared/decision';
import { useSoundsPreference } from '@pkgs/sounds-client/solid';
import { createSpeak } from '@pkgs/tts-root-client/solid';
import { useGamePresentation } from '@pkgs/turn-game-client/turn-games-context';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { SpeakingAvatar } from '@pkgs/ui-root-client/speaking-avatar';
import { SpectatorIndicator } from '@pkgs/ui-root-client/spectator-indicator';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { useLayoutMode } from '@pkgs/ui-root-client/use-layout-mode';
import { type Accessor, createMemo, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { PuzzleClockLabel } from './puzzle-clock-label';
import { PuzzleEmptyPoolState } from './puzzle-empty-pool-state';
import { usePuzzleGame } from './puzzle-game-context';
import type { PuzzlePlayBoardChrome } from './puzzle-play-layout';
import { PuzzlePlayLayout } from './puzzle-play-layout';
import { PuzzleRecommendationLegend } from './puzzle-recommendation-legend';
import { PuzzleResultAnnouncement } from './puzzle-result-announcement';
import { PuzzleShareLink } from './puzzle-share-link';
import { PuzzleStatusHeader } from './puzzle-status-header';
import { PuzzleTestLoadingStatus } from './puzzle-test-loading-status';
import { PuzzleTestProbes } from './puzzle-test-probes';
import { usePuzzleFeedConfig } from './use-puzzle-feed-config';
import { usePuzzlePlayScreenState } from './use-puzzle-play-screen-state';
import type { PuzzlePlayerChromeModel } from './use-puzzle-player-state';
import { usePuzzlePlayerState } from './use-puzzle-player-state';

const LOADING_SHELL_STATUS = 'loading' as const satisfies SolveStatus;
const LOADING_SHELL_HINT_STAGE = 'none' as const satisfies HintStage;
const COMPACT_AVATAR_SIZE = 56;
const WIDE_AVATAR_SIZE = 80;

const noop = (): void => {};

function usePuzzleAvatarSize(): () => number {
  const mode = useLayoutMode();
  return () => (mode() === 'wide' ? WIDE_AVATAR_SIZE : COMPACT_AVATAR_SIZE);
}

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
        syncKey={p.layoutKey() + p.recommendBump()}
        animated
        moveMs={PUZZLE_PIECE_MOVE_MS}
        marks={p.marks()}
        suggestions={p.suggestions()}
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

function PuzzlePlayerChrome(props: {
  model: PuzzlePlayerChromeModel;
  onFeedConfigApplied: () => void;
}): JSX.Element {
  const p = props.model;
  const myId = useMyId();
  const avatarSize = usePuzzleAvatarSize();
  const statusKind = (): PuzzleStatusKind => p.statusKind();
  const presentation = useGamePresentation();
  /** The solver's side as the game names it, once a position is shown. */
  const solverSide = (): string | null => {
    const position = p.boardPosition();
    return position === null || position.length === 0
      ? null
      : presentation(position).sideLabel(p.orientation());
  };
  return (
    <PuzzlePlayLayout
      backToRoot={p.backToRoot}
      puzzleId={p.puzzleId()}
      puzzleRating={p.rating()}
      puzzleThemes={p.themes()}
      spectator={p.isSpectator}
      assistant={
        <SpeakingAvatar
          message={p.coach()?.text ?? ''}
          contextKey={p.coach()?.positionKey ?? ''}
          speaker={createSpeak}
          dataSet={{ testid: 'puzzle-assistant' }}
          data-observation={p.coach()?.kind ?? ''}
          data-purpose={p.coach()?.purpose ?? ''}
          data-puzzle={p.coach()?.puzzleId ?? ''}
          header={
            <PuzzleStatusHeader
              kind={statusKind()}
              solverSide={solverSide()}
              trailing={
                <>
                  <PuzzleClockLabel elapsedMs={p.clockElapsedMs} />
                  <Show when={p.isSpectator()}>
                    <SpectatorIndicator />
                  </Show>
                  <Show when={!p.isSpectator() && p.puzzleId()} keyed>
                    {(puzzleId) => <PuzzleShareLink puzzleId={puzzleId} />}
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
        <PuzzleRecommendationLegend
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
      companion={<PuzzleCompanion p={p} />}
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

function shellHeaderKind(state: ShellPickState): PuzzleStatusKind {
  return state;
}

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

function ShellBoardSlot(props: {
  chrome: PuzzlePlayBoardChrome;
  pickState: ShellBoardPickState;
  includeAllPuzzles: () => void;
  startDenial: Decision | null;
}): JSX.Element {
  const [config] = usePuzzleFeedConfig();
  return (
    <PuzzleEmptyPoolState
      kind={props.pickState}
      config={config()}
      onIncludeAllPuzzles={props.includeAllPuzzles}
      onOpenFeedSettings={props.chrome.openFeedSettings}
      denial={props.startDenial}
    />
  );
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
  const avatarSize = usePuzzleAvatarSize();
  const boardKind = createMemo<ShellBoardPickState | null>(() => {
    const state = props.pickState();
    return state === 'loading' ? null : state;
  });
  return (
    <PuzzlePlayLayout
      backToRoot={props.backToRoot}
      testLoadingStatus={props.testLoadingStatus}
      assistant={
        <SpeakingAvatar
          message={shellCoachLine(props.pickState())}
          bubbleResolving={props.pickState() === 'loading'}
          header={
            <PuzzleStatusHeader kind={shellHeaderKind(props.pickState())} />
          }
          numberOfLines={2}
          avatarSize={avatarSize()}
        />
      }
      boardSlot={(_size, chrome) => (
        <Show when={boardKind()} keyed fallback={<LoadingState size="lg" />}>
          {(kind) => (
            <ShellBoardSlot
              chrome={chrome}
              pickState={kind}
              includeAllPuzzles={props.includeAllPuzzles}
              startDenial={props.startDenial()}
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
    <StackVertical grow self="stretch" testId="chess-puzzle-play-screen">
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
        {testPickStatus}
        <PuzzlePlayer
          puzzleId={activePuzzleId()!}
          playGeneration={attemptSeed()}
          readyGeneration={readyGeneration()}
          startNonce={startNonce()}
          onRequestNext={onRequestNext}
          onFeedConfigApplied={reselectActivePuzzleFromFeed}
        />
      </Show>
    </StackVertical>
  );
}
