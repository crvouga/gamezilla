import { SpeakingAvatarAssistant } from '@pkgs/assistant/client';
import { useMyId } from '@libs/auth/client/use-current-user';
import { DefineBackButton } from '@libs/spaces/client/nav/spaces-nav-context';
import { useSpaceRoomSelector } from '@libs/spaces/client/room/use-space-room-selector';
import { Box } from '@pkgs/ui';
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ChessPuzzlePlayAttr } from '../../shared/chess-puzzle-play';
import { ChessBoard } from '@pkgs/chess-board/chess-board';
import { ChessPuzzleActionBar } from './chess-puzzle-action-bar';
import { ChessPuzzleBoardSkeleton } from './chess-puzzle-board-skeleton';
import { ChessPuzzleStatusHeader } from './chess-puzzle-status-header';
import { useNextPuzzleId } from './use-next-puzzle-id';
import {
  usePuzzlePlayerState,
  type PuzzlePlayerChromeModel,
} from './use-puzzle-player-state';

const BOARD_MAX_WIDTH = 720;

const PuzzleBoardSlot = memo(function PuzzleBoardSlot(
  p: Pick<
    PuzzlePlayerChromeModel,
    | 'displayFen'
    | 'layoutKey'
    | 'orientation'
    | 'status'
    | 'onMove'
    | 'cellFeedback'
    | 'arrows'
  >
): ReactNode {
  if (p.displayFen === null || p.displayFen.length === 0) {
    return <ChessPuzzleBoardSkeleton />;
  }
  // `cellFeedback` / `arrows` are always defined (memoized in their hooks
  // with frozen empty defaults), so we pass them unconditionally. A
  // conditional prop-spread would change the prop-bag shape every render
  // and defeat the memo on `ChessBoard`'s canvas props.
  return (
    <ChessBoard
      controlled
      fen={p.displayFen}
      fenSyncKey={p.layoutKey}
      orientation={p.orientation}
      interactive={p.status === 'solving'}
      onMove={p.onMove}
      showCoordinates
      highlightLastMove
      highlightLegalMoves
      cellFeedback={p.cellFeedback}
      arrows={p.arrows}
    />
  );
});

function PuzzlePlayerChrome(p: PuzzlePlayerChromeModel): ReactNode {
  return (
    <Box sx={{ alignSelf: 'stretch' }}>
      <DefineBackButton onPress={p.backToRoot} />
      <Box
        sx={{
          alignSelf: 'center',
          maxWidth: BOARD_MAX_WIDTH,
          gap: 4,
          pb: 8,
          pt: 4,
        }}
        style={{ width: '100%' }}
      >
        <SpeakingAvatarAssistant
          assistant={p.assistant}
          header={
            <ChessPuzzleStatusHeader kind={p.statusKind} rating={p.rating} />
          }
          numberOfLines={2}
        />
        <PuzzleBoardSlot
          displayFen={p.displayFen}
          layoutKey={p.layoutKey}
          orientation={p.orientation}
          status={p.status}
          onMove={p.onMove}
          cellFeedback={p.cellFeedback}
          arrows={p.arrows}
        />
        <ChessPuzzleActionBar
          status={p.status}
          hintStage={p.hintStage}
          onHint={p.onHint}
          onRetry={p.onRetry}
          onNext={p.onNext}
        />
      </Box>
    </Box>
  );
}

type PuzzlePlayerProps = {
  puzzleId: string;
  onRequestNext: () => void;
};

/**
 * The player itself is the long-lived component: it owns the Skia board,
 * the chess.js game instance, the assistant, and all per-attempt local
 * state. Cycling puzzles updates the `puzzleId` prop in place — the
 * component instance survives, so we never tear down + rebuild the Skia
 * canvas, re-rasterize the piece SVGs, or replay the slide-from-zero
 * mount animation.
 */
function PuzzlePlayer({
  puzzleId,
  onRequestNext,
}: PuzzlePlayerProps): ReactNode {
  const p = usePuzzlePlayerState({ puzzleId, onRequestNext });
  return <PuzzlePlayerChrome {...p} />;
}

export function PuzzlePlayScreen(): ReactNode {
  const myId = useMyId();
  const roomPuzzleId = useSpaceRoomSelector(ChessPuzzlePlayAttr.puzzleId.from);

  const [activePuzzleId, setActivePuzzleId] = useState<string | null>(null);
  const [attemptSeed, setAttemptSeed] = useState(0);

  /** Last attemptSeed value we've already swapped `activePuzzleId` for. */
  const placedAttemptRef = useRef(0);

  const { puzzleId: nextId } = useNextPuzzleId({
    currentPuzzleId: activePuzzleId ?? roomPuzzleId,
    seed: `${myId}-${attemptSeed}`,
  });

  // Atomic puzzle-id swap: never null `activePuzzleId` between puzzles,
  // so `PuzzlePlayer` stays mounted across the entire session.
  //
  //   1. First mount with no candidate yet (`activePuzzleId === null`):
  //      resume the room session if there is one, else wait for `nextId`
  //      and adopt it as soon as it's available.
  //   2. Mid-session "Next" press (`attemptSeed > placedAttemptRef`):
  //      wait for `ClearChessPuzzlePlay` to land (`roomPuzzleId === null`)
  //      and for the candidate query to produce a fresh `nextId`, then
  //      swap `activePuzzleId` in a single state update. The old id is
  //      replaced directly, never via an intermediate `null`.
  useEffect(() => {
    if (activePuzzleId === null) {
      if (attemptSeed === 0 && roomPuzzleId !== null) {
        setActivePuzzleId(roomPuzzleId);
        placedAttemptRef.current = attemptSeed;
        return;
      }
      if (nextId !== null) {
        setActivePuzzleId(nextId);
        placedAttemptRef.current = attemptSeed;
      }
      return;
    }
    if (attemptSeed === placedAttemptRef.current) return;
    if (roomPuzzleId !== null) return;
    if (nextId === null || nextId === activePuzzleId) return;
    setActivePuzzleId(nextId);
    placedAttemptRef.current = attemptSeed;
  }, [activePuzzleId, attemptSeed, nextId, roomPuzzleId]);

  const onRequestNext = useCallback(() => {
    setAttemptSeed((s) => s + 1);
  }, []);

  // Until we have a first puzzle id, render only the skeleton in the
  // board slot's footprint — but DO NOT unmount the player once it has
  // mounted; pressing Next never re-enters this branch.
  if (activePuzzleId === null) {
    return (
      <Box sx={{ alignSelf: 'stretch' }}>
        <Box
          sx={{
            alignSelf: 'center',
            maxWidth: BOARD_MAX_WIDTH,
            gap: 4,
            pb: 8,
            pt: 4,
          }}
          style={{ width: '100%' }}
        >
          <ChessPuzzleBoardSkeleton />
        </Box>
      </Box>
    );
  }

  return (
    <PuzzlePlayer puzzleId={activePuzzleId} onRequestNext={onRequestNext} />
  );
}
