import { DefineBackButton } from '@libs/spaces/public/nav/spaces-nav-context';
import { SpaceSideRailExtras } from '@libs/spaces/public/space-event-log-placement';
import { Island, useLayoutMode } from '@pkgs/ui';
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

type PuzzlePlaySlots = {
  feedBar: JSX.Element;
  assistant: JSX.Element;
  board: JSX.Element;
  timeline: JSX.Element;
  actions: JSX.Element;
};

function buildSlots(
  p: PuzzlePlayLayoutProps,
  openFeedSettings: () => void
): PuzzlePlaySlots {
  const puzzleRating =
    p.puzzleRating !== undefined && p.puzzleRating > 0
      ? p.puzzleRating
      : undefined;
  return {
    feedBar: (
      <ChessPuzzleFeedBar
        puzzleId={p.puzzleId}
        rating={puzzleRating}
        onOpenFeedSettings={openFeedSettings}
      />
    ),
    assistant: p.assistant,
    board: (
      <ChessPuzzleBoardFrame>
        {(size) => p.boardSlot(size)}
      </ChessPuzzleBoardFrame>
    ),
    timeline: <ChessPuzzleMoveHistoryBar />,
    actions: (
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
    ),
  };
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

/**
 * Compact: chrome stacked flush (no gaps). Board + timeline pack against the
 * action bar; leftover height sits under the coach instead of splitting around
 * the board.
 */
function PuzzlePlayCompact(props: { slots: PuzzlePlaySlots }): JSX.Element {
  return (
    <div class="box flex-1 min-h-[0] min-w-[0] overflow-hidden">
      <div class="box shrink-0 min-w-[0] max-h-[30%] overflow-hidden">
        {props.slots.feedBar}
        <div class="box shrink min-w-[0] overflow-hidden">
          {props.slots.assistant}
        </div>
      </div>
      <div class="box flex-1 min-h-[0] min-w-[0] overflow-hidden justify-end">
        {props.slots.board}
        {props.slots.timeline}
      </div>
      <div class="box self-stretch shrink-0">{props.slots.actions}</div>
    </div>
  );
}

function PuzzlePlayWide(props: { slots: PuzzlePlaySlots }): JSX.Element {
  return (
    <>
      <SpaceSideRailExtras>
        <div class="box flex-1 min-h-[0] min-w-[0]">
          {props.slots.feedBar}
          <div class="box shrink min-w-[0]">{props.slots.assistant}</div>
          <div class="box shrink-0">{props.slots.timeline}</div>
          <div class="box flex-1 min-h-[0]" aria-hidden="true" />
          <div class="box shrink-0">{props.slots.actions}</div>
        </div>
      </SpaceSideRailExtras>
      <Island class="flex-1 min-w-[0] min-h-[0] overflow-hidden">
        {props.slots.board}
      </Island>
    </>
  );
}

export function PuzzlePlayLayout(p: PuzzlePlayLayoutProps): JSX.Element {
  const [feedSettingsOpen, setFeedSettingsOpen] = createSignal(false);
  const openFeedSettings = (): void => {
    setFeedSettingsOpen(true);
  };
  const closeFeedSettings = (): void => {
    setFeedSettingsOpen(false);
  };
  const mode = useLayoutMode();
  const slots = buildSlots(p, openFeedSettings);
  return (
    <div
      class="box flex-1 min-h-[0] min-w-[0] self-stretch overflow-hidden"
      data-testid="chess-puzzle-play-screen"
      data-screen="chess-puzzle-play"
    >
      <DefineBackButton onPress={p.backToRoot} />
      {p.e2eLoadingStatus}
      {mode() === 'wide' ? (
        <PuzzlePlayWide slots={slots} />
      ) : (
        <PuzzlePlayCompact slots={slots} />
      )}
      <CelebrationLayer completion={p.completion} />
      {p.e2eHints}
      <ChessPuzzleFeedSettingsModal
        visible={feedSettingsOpen()}
        onClose={closeFeedSettings}
        onFeedConfigApplied={p.onFeedConfigApplied}
      />
    </div>
  );
}
