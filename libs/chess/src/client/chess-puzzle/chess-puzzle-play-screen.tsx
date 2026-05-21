import { SpeakingAvatarAssistant } from '@gamezilla/assistant/client';
import { useMyId } from '@gamezilla/auth/client/use-current-user';
import { DefineBackButton } from '@gamezilla/spaces/client/nav/spaces-nav-context';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@gamezilla/spaces/client/room/use-space-room-selector';
import { Box, Text } from '@gamezilla/ui';
import { Trans } from '@lingui/react/macro';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
  StartChessPuzzlePlay,
} from '../../shared/chess-puzzle-play';
import { ChessBoard } from '../chess-board/chess-board';
import { ChessPuzzleActionBar } from './chess-puzzle-action-bar';
import { ChessPuzzleBoardSkeleton } from './chess-puzzle-board-skeleton';
import { usePuzzleEntity } from './chess-puzzle-play-queries';
import { ChessPuzzleStatusHeader } from './chess-puzzle-status-header';
import { useNextPuzzleId } from './use-next-puzzle-id';
import {
  usePuzzlePlayerState,
  type PuzzlePlayerChromeModel,
} from './use-puzzle-player-state';

const BOARD_MAX_WIDTH = 720;

function LoadingFirstPuzzle(): ReactNode {
  return (
    <Box
      sx={{
        alignSelf: 'stretch',
        gap: 4,
        px: 4,
        pt: 8,
        alignItems: 'center',
      }}
    >
      <Text
        variant="body"
        sx={{ color: 'textSecondary', textAlign: 'center' }}
        label={<Trans>Loading puzzle…</Trans>}
      />
    </Box>
  );
}

function PuzzleBoardSlot(
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
      {...(p.cellFeedback !== undefined
        ? { cellFeedback: p.cellFeedback }
        : {})}
      {...(p.arrows.length > 0 ? { arrows: p.arrows } : {})}
    />
  );
}

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
          onNext={() => void p.onNext()}
        />
      </Box>
    </Box>
  );
}

type PuzzlePlayerProps = {
  puzzleId: string;
  onRequestNext: () => void;
};

function PuzzlePlayer({
  puzzleId,
  onRequestNext,
}: PuzzlePlayerProps): ReactNode {
  const p = usePuzzlePlayerState({ puzzleId, onRequestNext });
  return <PuzzlePlayerChrome {...p} />;
}

export function PuzzlePlayScreen(): ReactNode {
  const myId = useMyId();
  const dispatch = useSpaceRoomDispatch();
  const roomStatus = useSpaceRoomSelector(ChessPuzzlePlayAttr.status.from);
  const roomPuzzleId = useSpaceRoomSelector(ChessPuzzlePlayAttr.puzzleId.from);

  const [activePuzzleId, setActivePuzzleId] = useState<string | null>(null);
  const [attemptSeed, setAttemptSeed] = useState(0);

  const { puzzleId: nextId, loading: nextLoading } = useNextPuzzleId({
    currentPuzzleId: activePuzzleId ?? roomPuzzleId,
    seed: `${myId}-${attemptSeed}`,
  });

  // Picking the next puzzle to render:
  //   - First mount (`attemptSeed === 0`): if the room is mid-session, resume
  //     it by mirroring `roomPuzzleId`; otherwise fall through to `nextId`.
  //   - After the user pressed Next (`attemptSeed > 0`): the Clear command
  //     is in-flight and `roomPuzzleId` is still the just-finished puzzle.
  //     Wait until the Clear lands (`roomPuzzleId === null`) before picking
  //     `nextId`, otherwise we'd snap right back to the old puzzle.
  useEffect(() => {
    if (activePuzzleId !== null) return;
    if (attemptSeed === 0 && roomPuzzleId !== null) {
      setActivePuzzleId(roomPuzzleId);
      return;
    }
    if (attemptSeed > 0 && roomPuzzleId !== null) return;
    if (nextId !== null) {
      setActivePuzzleId(nextId);
    }
  }, [activePuzzleId, attemptSeed, nextId, roomPuzzleId]);

  const { fen, movesStr } = usePuzzleEntity(activePuzzleId ?? '');

  useEffect(() => {
    if (activePuzzleId === null) return;
    if (roomStatus !== CHESS_PUZZLE_PLAY_STATUS.idle) return;
    if (fen.length === 0 || movesStr.length === 0) return;
    dispatch(
      StartChessPuzzlePlay({
        puzzleId: activePuzzleId,
        fen,
        moves: movesStr,
      })
    );
  }, [activePuzzleId, dispatch, fen, movesStr, roomStatus]);

  const onRequestNext = useCallback(() => {
    setActivePuzzleId(null);
    setAttemptSeed((s) => s + 1);
  }, []);

  if (nextLoading || activePuzzleId === null) {
    return (
      <Box sx={{ alignSelf: 'stretch' }}>
        <LoadingFirstPuzzle />
      </Box>
    );
  }

  return (
    <PuzzlePlayer
      key={activePuzzleId}
      puzzleId={activePuzzleId}
      onRequestNext={onRequestNext}
    />
  );
}
