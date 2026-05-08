import { ChessArtwork } from '@gamezilla/client/spaces/games/chess/chess-artwork';
import { ChessMainMenu } from '@gamezilla/client/spaces/games/chess/chess-main-menu';
import { ConnectFourArtwork } from '@gamezilla/client/spaces/games/connect-four/connect-four-artwork';
import { GomokuArtwork } from '@gamezilla/client/spaces/games/gomoku/gomoku-artwork';
import {
  MainMenuScreen,
  type MainMenuItem,
} from '@gamezilla/client/spaces/games/main-menu-screen';
import { TicTacToeArtwork } from '@gamezilla/client/spaces/games/tic-tac-toe/tic-tac-toe-artwork';
import { useSpaceSessionUi } from '@gamezilla/client/spaces/layout/space-session-ui-context';
import {
  useSpaceDispatch,
  useSpaceSelector,
} from '@gamezilla/client/spaces/room/use-space-room-selector';
import { useCurrentSpaceRole } from '@gamezilla/client/spaces/use-current-space-role';
import {
  SpaceGame,
  type SelectedSpaceGame,
} from '@gamezilla/domain/spaces/games/games';
import {
  GamesRoomAttr,
  SelectGame,
} from '@gamezilla/domain/spaces/space-module';
import { Box } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

const GAME_LEADING_SIZE = 48;

function GameMenuLeading({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        width: GAME_LEADING_SIZE,
        height: GAME_LEADING_SIZE,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {children}
    </Box>
  );
}

function buildSpaceGameMenuItems(
  isHost: boolean,
  selectedGame: SelectedSpaceGame,
  onSelectGame: (game: SelectedSpaceGame) => void
): MainMenuItem[] {
  const chessItem: MainMenuItem = {
    key: 'chess',
    title: <Trans>Chess</Trans>,
    leading: (
      <GameMenuLeading>
        <ChessArtwork size={GAME_LEADING_SIZE} />
      </GameMenuLeading>
    ),
    selected: selectedGame === SpaceGame.chess,
    ...(isHost ? { onPress: () => onSelectGame(SpaceGame.chess) } : {}),
  };

  return [
    chessItem,
    {
      key: 'tic-tac-toe',
      title: <Trans>Tic-tac-toe</Trans>,
      caption: <Trans>Coming soon</Trans>,
      disabled: true,
      leading: (
        <GameMenuLeading>
          <TicTacToeArtwork size={GAME_LEADING_SIZE} />
        </GameMenuLeading>
      ),
    },
    {
      key: 'connect-four',
      title: <Trans>Connect Four</Trans>,
      caption: <Trans>Coming soon</Trans>,
      disabled: true,
      leading: (
        <GameMenuLeading>
          <ConnectFourArtwork size={GAME_LEADING_SIZE} />
        </GameMenuLeading>
      ),
    },
    {
      key: 'gomoku',
      title: <Trans>Gomoku</Trans>,
      caption: <Trans>Coming soon</Trans>,
      disabled: true,
      leading: (
        <GameMenuLeading>
          <GomokuArtwork size={GAME_LEADING_SIZE} />
        </GameMenuLeading>
      ),
    },
  ];
}

function GamesMainMenu(): ReactNode {
  const { spaceId } = useSpaceSessionUi();
  const role = useCurrentSpaceRole(spaceId);
  const isHost = role === 'host';
  const selectedGame = useSpaceSelector(GamesRoomAttr.selected.from);

  const dispatch = useSpaceDispatch();
  const onSelectGame = useCallback(
    (game: SelectedSpaceGame) => {
      dispatch(SelectGame({ game }));
    },
    [dispatch]
  );

  const items = useMemo(
    () => buildSpaceGameMenuItems(isHost, selectedGame, onSelectGame),
    [isHost, onSelectGame, selectedGame]
  );

  return (
    <MainMenuScreen
      helper={
        !isHost ? (
          <Trans>The host picks the game for this space.</Trans>
        ) : undefined
      }
      items={items}
    />
  );
}

/** Game picker for a space. Reads room state via {@link useSpaceSelector}. */
export function SpaceGamePicker(): ReactNode {
  const selectedGame = useSpaceSelector(GamesRoomAttr.selected.from);
  switch (selectedGame) {
    case SpaceGame.chess:
      return <ChessMainMenu />;
    default:
      return <GamesMainMenu />;
  }
}
