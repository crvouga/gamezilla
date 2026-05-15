import { SpeakingAvatarAssistant } from '@gamezilla/assistant/client';
import { useMyId } from '@gamezilla/auth/client/use-current-user';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@gamezilla/spaces/client/room/use-space-room-selector';
import { Box, IconButton, IconSymbol, Text, useTheme } from '@gamezilla/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
  StartChessPuzzlePlay,
} from '../../shared/chess-puzzle-play';
import { ChessBoard } from '../chess-board/chess-board';
import { ChessPuzzleActionBar } from './chess-puzzle-action-bar';
import { usePuzzleEntity } from './chess-puzzle-play-queries';
import { ChessPuzzleStatusHeader } from './chess-puzzle-status-header';
import { useNextPuzzleId } from './use-next-puzzle-id';
import {
  type PuzzlePlayerChromeModel,
  usePuzzlePlayerState,
} from './use-puzzle-player-state';

const BOARD_MAX_WIDTH = 720;
const BACK_BUTTON_SIZE = 40;
const BACK_ROW_PADDING_TOP = 12;
const BACK_ROW_PADDING_HORIZONTAL = 12;

function BackButtonRow({ onPress }: { onPress: () => void }): ReactNode {
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <Box
      style={{
        alignSelf: 'stretch',
        alignItems: 'flex-start',
        height: BACK_BUTTON_SIZE + BACK_ROW_PADDING_TOP,
        paddingHorizontal: BACK_ROW_PADDING_HORIZONTAL,
        paddingTop: BACK_ROW_PADDING_TOP,
      }}
    >
      <IconButton
        size={BACK_BUTTON_SIZE}
        background="surface"
        onPress={onPress}
        accessibilityLabel={t`Back`}
      >
        <IconSymbol
          name="chevron.right"
          size={20}
          color={theme.colors.text}
          style={{ transform: [{ scaleX: -1 }] }}
        />
      </IconButton>
    </Box>
  );
}

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

function PuzzlePlayerChrome(p: PuzzlePlayerChromeModel): ReactNode {
  return (
    <Box sx={{ alignSelf: 'stretch' }}>
      <BackButtonRow onPress={p.backToRoot} />
      <Box
        sx={{
          alignSelf: 'center',
          maxWidth: BOARD_MAX_WIDTH,
          gap: 4,
          pb: 8,
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
        />
        <ChessPuzzleActionBar
          status={p.status}
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

  useEffect(() => {
    if (activePuzzleId !== null) return;
    if (roomPuzzleId !== null) {
      setActivePuzzleId(roomPuzzleId);
      return;
    }
    if (nextId !== null) {
      setActivePuzzleId(nextId);
    }
  }, [activePuzzleId, nextId, roomPuzzleId]);

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

  useEffect(() => {
    if (activePuzzleId !== null) return;
    if (nextId !== null) {
      setActivePuzzleId(nextId);
    }
  }, [activePuzzleId, nextId]);

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
