import { DefineBackButton } from '@libs/spaces/public/nav/spaces-nav-context';
import { SpaceSideRailExtras } from '@libs/spaces/public/space-event-log-placement';
import { Box, Island, useLayoutMode } from '@pkgs/ui';
import { type Accessor, createSignal, type JSX, Show } from 'solid-js';

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
      <ChessPuzzleBoardFrame
        overlay={
          <Show when={p.completion()}>
            {(completion) => (
              <ChessPuzzleCelebrationOverlay
                completion={completion()}
                onDisplayEloChange={noopElo}
              />
            )}
          </Show>
        }
      >
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

function PuzzlePlayCompact(props: { slots: PuzzlePlaySlots }): JSX.Element {
  return (
    <Box sx={{ flex: 1, minHeight: 0, gap: 4, pt: 4 }}>
      {props.slots.feedBar}
      {props.slots.assistant}
      {props.slots.board}
      <Box sx={{ alignSelf: 'stretch', gap: 2 }}>
        {props.slots.timeline}
        {props.slots.actions}
      </Box>
    </Box>
  );
}

function PuzzlePlayWide(props: { slots: PuzzlePlaySlots }): JSX.Element {
  return (
    <>
      <SpaceSideRailExtras>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          {props.slots.feedBar}
          <Box sx={{ px: 3, pb: 3 }}>{props.slots.assistant}</Box>
          <Box sx={{ flex: 1, minHeight: 0, px: 3, pb: 3 }}>
            {props.slots.timeline}
          </Box>
          {props.slots.actions}
        </Box>
      </SpaceSideRailExtras>
      <Island sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
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
    <Box
      sx={{ flex: 1, minHeight: 0, alignSelf: 'stretch' }}
      dataSet={{
        testid: 'chess-puzzle-play-screen',
        screen: 'chess-puzzle-play',
      }}
    >
      <DefineBackButton onPress={p.backToRoot} />
      {p.e2eLoadingStatus}
      {mode() === 'wide' ? (
        <PuzzlePlayWide slots={slots} />
      ) : (
        <PuzzlePlayCompact slots={slots} />
      )}
      {p.e2eHints}
      <ChessPuzzleFeedSettingsModal
        visible={feedSettingsOpen()}
        onClose={closeFeedSettings}
        onFeedConfigApplied={p.onFeedConfigApplied}
      />
    </Box>
  );
}
