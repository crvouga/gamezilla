import { ChessArtwork } from '@gamezilla/client/spaces/games/chess/chess-artwork';
import { ChessMainMenu } from '@gamezilla/client/spaces/games/chess/chess-main-menu';
import { ConnectFourArtwork } from '@gamezilla/client/spaces/games/connect-four/connect-four-artwork';
import { GomokuArtwork } from '@gamezilla/client/spaces/games/gomoku/gomoku-artwork';
import {
  MainMenuScreen,
  type MainMenuItem,
} from '@gamezilla/client/spaces/games/main-menu-screen';
import { TicTacToeArtwork } from '@gamezilla/client/spaces/games/tic-tac-toe/tic-tac-toe-artwork';
import { useSpaceRoomState } from '@gamezilla/client/spaces/room/space-room-context';
import { useCurrentSpaceRole } from '@gamezilla/client/spaces/use-current-space-role';
import {
  SpaceGame,
  type SelectedSpaceGame,
} from '@gamezilla/domain/spaces/games/games';
import { Box } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

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

function GamesMainMenu({
  isHost,
  selectedGame,
  onSelectGame,
}: {
  isHost: boolean;
  selectedGame: SelectedSpaceGame;
  onSelectGame: (game: SelectedSpaceGame) => void;
}) {
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

export type SpaceGamePickerProps = {
  spaceId: string;
};

/** Game picker for a space. Reads shared room state via context. */
export function SpaceGamePicker({ spaceId }: SpaceGamePickerProps): ReactNode {
  const role = useCurrentSpaceRole(spaceId);
  const isHost = role === 'host';
  const room = useSpaceRoomState();
  if (room === null) return null;
  const { selectedGame, selectGame } = room;
  if (selectedGame === SpaceGame.chess) {
    return (
      <ChessMainMenu isHost={isHost} onBackToGames={() => selectGame(null)} />
    );
  }
  return (
    <GamesMainMenu
      isHost={isHost}
      selectedGame={selectedGame}
      onSelectGame={selectGame}
    />
  );
}
