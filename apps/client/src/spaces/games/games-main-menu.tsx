import { ChessMainMenu } from '@gamezilla/client/spaces/games/chess/chess-main-menu';
import {
  MainMenuScreen,
  type MainMenuItem,
} from '@gamezilla/client/spaces/games/main-menu-screen';
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
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

function buildSpaceGameMenuItems(
  isHost: boolean,
  selectedGame: SelectedSpaceGame,
  onSelectGame: (game: SelectedSpaceGame) => void
): MainMenuItem[] {
  const chessItem: MainMenuItem = {
    key: 'chess',
    title: <Trans>Chess</Trans>,
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
    },
    {
      key: 'connect-four',
      title: <Trans>Connect Four</Trans>,
      caption: <Trans>Coming soon</Trans>,
      disabled: true,
    },
    {
      key: 'gomoku',
      title: <Trans>Gomoku</Trans>,
      caption: <Trans>Coming soon</Trans>,
      disabled: true,
    },
  ];
}

function GameListMenu(): ReactNode {
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
      title={<Trans>Games</Trans>}
      subtitle={<Trans>Pick a game to play.</Trans>}
      helper={
        !isHost ? (
          <Trans>The host picks the game for this space.</Trans>
        ) : undefined
      }
      items={items}
    />
  );
}

/**
 * Top-level games menu for a space. Routes to the selected game's main menu
 * (e.g. {@link ChessMainMenu}) or shows the game list when no game is
 * selected. Reads room state via {@link useSpaceSelector}.
 */
export function GamesMainMenu(): ReactNode {
  const selectedGame = useSpaceSelector(GamesRoomAttr.selected.from);
  switch (selectedGame) {
    case SpaceGame.chess:
      return <ChessMainMenu />;
    default:
      return <GameListMenu />;
  }
}
