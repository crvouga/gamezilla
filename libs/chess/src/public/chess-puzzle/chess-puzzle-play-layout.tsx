import { DefineBackButton } from '@libs/spaces/public/nav/spaces-nav-context';
import { Island, spacingScale } from '@pkgs/ui';
import {
  type Accessor,
  createMemo,
  createSignal,
  type JSX,
  Show,
} from 'solid-js';

import type { HintStage } from '../../shared/puzzle-session/hint-stage';
import { ChessPuzzleActionBar } from './chess-puzzle-action-bar';
import { ChessPuzzleBoardFrame } from './chess-puzzle-board-frame';
import { ChessPuzzleCelebrationOverlay } from './chess-puzzle-celebration-overlay';
import { ChessPuzzleFeedBar } from './chess-puzzle-feed-bar';
import { ChessPuzzleFeedSettingsModal } from './chess-puzzle-feed-settings-modal';
import { ChessPuzzleMoveHistoryBar } from './chess-puzzle-move-history-bar';
import type { PuzzleCompletion } from './use-chess-puzzle-completion';
import type { SolveStatus } from './use-chess-puzzle-solver';

const noopElo = (): void => {};
/** Tight inset so the square board can fill its well. */
const BOARD_WELL_PADDING_PX = spacingScale(2);

type PlayChromeProps = {
  layout: PuzzlePlayLayoutProps;
  openFeedSettings: () => void;
};

function completionKey(completion: PuzzleCompletion): string {
  return [
    completion.outcome,
    completion.ratingBefore,
    completion.ratingAfter,
    completion.puzzleRating,
    completion.streak,
  ].join(':');
}

export type PuzzlePlayLayoutProps = {
  backToRoot: () => void;
  assistant: JSX.Element;
  boardSlot: (size: number) => JSX.Element;
  puzzleId?: string;
  puzzleRating?: number;
  status: Accessor<SolveStatus>;
  hintStage: Accessor<HintStage>;
  canGoBack: Accessor<boolean>;
  canGoForward: Accessor<boolean>;
  onHint: () => void;
  onSolution: () => void;
  onBack: () => void;
  onForward: () => void;
  onRetry: () => void;
  onNext: () => void;
  onFeedConfigApplied: () => void;
  completion: Accessor<PuzzleCompletion | null>;
  e2eHints?: JSX.Element;
  e2eLoadingStatus?: JSX.Element;
};

function puzzleRatingOrUndef(rating: number | undefined): number | undefined {
  if (rating !== undefined && rating > 0) return rating;
  return undefined;
}

function PuzzlePlayFeed(props: PlayChromeProps): JSX.Element {
  return (
    <ChessPuzzleFeedBar
      puzzleId={props.layout.puzzleId}
      rating={puzzleRatingOrUndef(props.layout.puzzleRating)}
      onOpenFeedSettings={props.openFeedSettings}
    />
  );
}

function PuzzlePlayActions(props: {
  layout: PuzzlePlayLayoutProps;
}): JSX.Element {
  const p = props.layout;
  return (
    <ChessPuzzleActionBar
      status={p.status()}
      hintStage={p.hintStage()}
      canGoBack={p.canGoBack()}
      canGoForward={p.canGoForward()}
      onHint={p.onHint}
      onSolution={p.onSolution}
      onBack={p.onBack}
      onForward={p.onForward}
      onRetry={p.onRetry}
      onNext={p.onNext}
    />
  );
}

function PuzzlePlayBoard(props: {
  boardSlot: (size: number) => JSX.Element;
}): JSX.Element {
  return (
    <ChessPuzzleBoardFrame>
      {(size) => props.boardSlot(size)}
    </ChessPuzzleBoardFrame>
  );
}

/**
 * Largest square that fits the pane. Leftover space stays around the board
 * (app background), not as a blank mat above a bottom-aligned board.
 */
function PuzzlePlayBoardWell(props: {
  boardSlot: (size: number) => JSX.Element;
}): JSX.Element {
  return (
    <div
      class="box flex-1 min-h-[0] min-w-[0] overflow-hidden items-center justify-center self-stretch"
      style={{ 'container-type': 'size' }}
    >
      <Island
        class="overflow-hidden min-h-[0] min-w-[0] shrink"
        style={{
          width: 'min(100cqw, 100cqh)',
          height: 'min(100cqw, 100cqh)',
          'max-width': '100%',
          'max-height': '100%',
          padding: `${BOARD_WELL_PADDING_PX}px`,
        }}
      >
        <PuzzlePlayBoard boardSlot={props.boardSlot} />
      </Island>
    </div>
  );
}

function CelebrationLayer(props: {
  completion: Accessor<PuzzleCompletion | null>;
}): JSX.Element {
  const [dismissedKey, setDismissedKey] = createSignal<string | null>(null);
  const completion = createMemo(() => props.completion());
  const visible = createMemo(() => {
    const current = completion();
    if (current === null) return false;
    return dismissedKey() !== completionKey(current);
  });
  return (
    <Show when={completion()}>
      {(current) => (
        <ChessPuzzleCelebrationOverlay
          completion={current()}
          visible={visible()}
          onClose={() => setDismissedKey(completionKey(current()))}
          onDisplayEloChange={noopElo}
        />
      )}
    </Show>
  );
}

/** Single-column: feed + coach + square board + timeline/actions. */
function PuzzlePlayStack(props: PlayChromeProps): JSX.Element {
  return (
    <div class="box flex-1 min-h-[0] min-w-[0] overflow-hidden">
      <div class="box shrink-0 min-w-[0]">
        <PuzzlePlayFeed
          layout={props.layout}
          openFeedSettings={props.openFeedSettings}
        />
        <div class="box shrink-0 min-w-[0] overflow-hidden">
          {props.layout.assistant}
        </div>
      </div>
      <PuzzlePlayBoardWell boardSlot={props.layout.boardSlot} />
      <div class="box shrink-0">
        <ChessPuzzleMoveHistoryBar />
      </div>
      <div class="box self-stretch shrink-0">
        <PuzzlePlayActions layout={props.layout} />
      </div>
    </div>
  );
}

export function PuzzlePlayLayout(props: PuzzlePlayLayoutProps): JSX.Element {
  const [feedSettingsOpen, setFeedSettingsOpen] = createSignal(false);
  const openFeedSettings = (): void => {
    setFeedSettingsOpen(true);
  };
  const closeFeedSettings = (): void => {
    setFeedSettingsOpen(false);
  };
  return (
    <div
      class="box flex-1 min-h-[0] min-w-[0] self-stretch overflow-hidden"
      data-testid="chess-puzzle-play-screen"
      data-screen="chess-puzzle-play"
    >
      <DefineBackButton onPress={props.backToRoot} />
      {props.e2eLoadingStatus}
      <PuzzlePlayStack layout={props} openFeedSettings={openFeedSettings} />
      <CelebrationLayer completion={props.completion} />
      {props.e2eHints}
      <ChessPuzzleFeedSettingsModal
        visible={feedSettingsOpen()}
        onClose={closeFeedSettings}
        onFeedConfigApplied={props.onFeedConfigApplied}
      />
    </div>
  );
}
