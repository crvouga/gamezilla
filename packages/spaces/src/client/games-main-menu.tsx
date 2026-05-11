import {
  MainMenuScreen,
  type MainMenuItem,
} from '@gamezilla/ui/components/main-menu-screen';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

import { useGamesRegistry } from './games-registry-context';
import { useSpaceSessionUi } from './space-session-ui-context';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from './use-space-room-selector';
import { useCurrentSpaceRole } from './use-current-space-role';
import {
  GamesRoomAttr,
  SelectGame,
  type SelectedGameId,
} from '@gamezilla/spaces/shared/games';
import type { GameClientDefinition } from '@gamezilla/spaces/shared/game';

function buildSpaceGameMenuItems(
  games: readonly GameClientDefinition[],
  isHost: boolean,
  selectedGame: SelectedGameId,
  onSelectGame: (game: SelectedGameId) => void
): MainMenuItem[] {
  return games.map((game) => ({
    key: game.id,
    title: game.title,
    selected: selectedGame === game.id,
    ...(isHost ? { onPress: () => onSelectGame(game.id) } : {}),
  }));
}

function GameListMenu({
  games,
}: {
  games: readonly GameClientDefinition[];
}): ReactNode {
  const { spaceId } = useSpaceSessionUi();
  const role = useCurrentSpaceRole(spaceId);
  const isHost = role === 'host';
  const selectedGame = useSpaceRoomSelector(GamesRoomAttr.selected.from);

  const dispatch = useSpaceRoomDispatch();
  const onSelectGame = useCallback(
    (game: SelectedGameId) => {
      dispatch(SelectGame({ game }));
    },
    [dispatch]
  );

  const items = useMemo(
    () => buildSpaceGameMenuItems(games, isHost, selectedGame, onSelectGame),
    [games, isHost, onSelectGame, selectedGame]
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
 * (via {@link GameClientDefinition.MainMenu}) or shows the game list when no
 * game is selected. Game registry is provided by the composition root via
 * {@link GamesRegistryProvider}.
 */
export function GamesMainMenu(): ReactNode {
  const games = useGamesRegistry();
  const selectedGame = useSpaceRoomSelector(GamesRoomAttr.selected.from);
  const dispatch = useSpaceRoomDispatch();
  const onBackToGames = useCallback(() => {
    dispatch(SelectGame({ game: null }));
  }, [dispatch]);

  if (selectedGame !== null) {
    const game = games.find((g) => g.id === selectedGame);
    if (game !== undefined) {
      const SelectedMenu = game.MainMenu;
      return <SelectedMenu onBackToGames={onBackToGames} />;
    }
  }
  return <GameListMenu games={games} />;
}
