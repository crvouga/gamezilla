/**
 * Puzzle play chrome, split by layout mode.
 *
 * Compact: one column — feed bar, assistant, square board, move strip, actions.
 * Wide: two islands — the board on the left, a fixed rail on the right with
 * the feed bar, assistant, game timeline (move strip) and the action bar.
 */

import { DefineBackButton } from '@libs/spaces/public/nav/spaces-nav-context';
import {
  Box,
  componentDataSet,
  ISLAND_GAP_STEP,
  Island,
  useLayoutMode,
} from '@pkgs/ui';
import { type ReactNode, useCallback, useState } from 'react';
import { ChessPuzzleActionBar } from './chess-puzzle-action-bar';
import { ChessPuzzleBoardFrame } from './chess-puzzle-board-frame';
import { ChessPuzzleCelebrationOverlay } from './chess-puzzle-celebration-overlay';
import { ChessPuzzleFeedBar } from './chess-puzzle-feed-bar';
import { ChessPuzzleFeedSettingsModal } from './chess-puzzle-feed-settings-modal';
import { ChessPuzzleMoveHistoryBar } from './chess-puzzle-move-history-bar';
import type { SolveStatus } from './use-chess-puzzle-solver';
import type { HintStage } from './use-hint-stage';
import type { PuzzlePlayerChromeModel } from './use-puzzle-player-state';

/** Right-hand rail width on wide layouts (board takes the rest). */
const PUZZLE_RAIL_WIDTH = 360;

const noopElo = (_rating: number): void => {};

export type PuzzlePlayLayoutProps = {
  backToRoot: () => void;
  assistant: ReactNode;
  boardSlot: (size: number) => ReactNode;
  puzzleId?: string;
  puzzleRating?: number;
  status: SolveStatus;
  hintStage: HintStage;
  canGoBack: boolean;
  canGoForward: boolean;
  onHint: () => void;
  onSolution: () => void;
  onBack: () => void;
  onForward: () => void;
  onRetry: () => void;
  onNext: () => void;
  onFeedConfigApplied: () => void;
  completion: PuzzlePlayerChromeModel['completion'];
  e2eHints?: ReactNode;
  e2eLoadingStatus?: ReactNode;
};

type PuzzlePlaySlots = {
  feedBar: ReactNode;
  assistant: ReactNode;
  board: ReactNode;
  timeline: ReactNode;
  actions: ReactNode;
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
          p.completion !== null ? (
            <ChessPuzzleCelebrationOverlay
              completion={p.completion}
              onDisplayEloChange={noopElo}
            />
          ) : null
        }
      >
        {(size) => p.boardSlot(size)}
      </ChessPuzzleBoardFrame>
    ),
    timeline: <ChessPuzzleMoveHistoryBar />,
    actions: (
      <ChessPuzzleActionBar
        status={p.status}
        hintStage={p.hintStage}
        canGoBack={p.canGoBack}
        canGoForward={p.canGoForward}
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

function PuzzlePlayCompact({ slots }: { slots: PuzzlePlaySlots }): ReactNode {
  return (
    <Box sx={{ flex: 1, minHeight: 0, gap: 4, pt: 4 }}>
      {slots.feedBar}
      {slots.assistant}
      {slots.board}
      <Box sx={{ alignSelf: 'stretch', gap: 2 }}>
        {slots.timeline}
        {slots.actions}
      </Box>
    </Box>
  );
}

function PuzzlePlayWide({ slots }: { slots: PuzzlePlaySlots }): ReactNode {
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: ISLAND_GAP_STEP,
      }}
    >
      <Island sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>{slots.board}</Island>
      <Island sx={{ width: PUZZLE_RAIL_WIDTH, minHeight: 0, p: 0 }}>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          {slots.feedBar}
          <Box sx={{ px: 3, pb: 3 }}>{slots.assistant}</Box>
          <Box sx={{ flex: 1, minHeight: 0, px: 3, pb: 3 }}>
            {slots.timeline}
          </Box>
          {slots.actions}
        </Box>
      </Island>
    </Box>
  );
}

export function PuzzlePlayLayout(p: PuzzlePlayLayoutProps): ReactNode {
  const [feedSettingsOpen, setFeedSettingsOpen] = useState(false);
  const openFeedSettings = useCallback(() => setFeedSettingsOpen(true), []);
  const closeFeedSettings = useCallback(() => setFeedSettingsOpen(false), []);
  const mode = useLayoutMode();
  const slots = buildSlots(p, openFeedSettings);
  return (
    <Box
      sx={{ flex: 1, minHeight: 0, alignSelf: 'stretch' }}
      {...componentDataSet('ChessPuzzlePlayScreen', {
        screen: 'chess-puzzle-play',
      })}
    >
      <DefineBackButton onPress={p.backToRoot} />
      {p.e2eLoadingStatus}
      {mode === 'wide' ? (
        <PuzzlePlayWide slots={slots} />
      ) : (
        <PuzzlePlayCompact slots={slots} />
      )}
      {p.e2eHints}
      <ChessPuzzleFeedSettingsModal
        visible={feedSettingsOpen}
        onClose={closeFeedSettings}
        onFeedConfigApplied={p.onFeedConfigApplied}
      />
    </Box>
  );
}
