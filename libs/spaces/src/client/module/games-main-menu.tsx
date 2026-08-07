import type { GameClientDefinition } from '@libs/spaces/shared/game';
import {
  GamesRoomAttr,
  type SelectedGameId,
  SelectGame,
} from '@libs/spaces/shared/games';
import { Trans } from '@lingui/react/macro';
import { FadeSwitch } from '@pkgs/ui';
import {
  type MainMenuItem,
  MainMenuScreen,
} from '@pkgs/ui/components/main-menu-screen';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { useSpaceSessionUi } from '../active-space/space-session-ui-context';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '../room/use-space-room-selector';
import { useCurrentSpaceRole } from '../use-current-space-role';
import { GamesMenuAttribution } from './games-menu-attribution';
import { useGamesRegistry } from './games-registry-context';

function buildSpaceGameMenuItems(
  games: readonly GameClientDefinition[],
  isHost: boolean,
  selectedGame: SelectedGameId,
  onSelectGame: (game: SelectedGameId) => void
): MainMenuItem[] {
  return games.map((game) => ({
    key: game.id,
    title: game.title,
    testID: `game-menu-${game.id}`,
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

  // Warm each game's heavy assets while the picker is shown so selecting a
  // game does not block on a first-time load (no Suspense spinner on entry).
  useEffect(() => {
    for (const game of games) game.preload?.();
  }, [games]);

  const items = useMemo(
    () => buildSpaceGameMenuItems(games, isHost, selectedGame, onSelectGame),
    [games, isHost, onSelectGame, selectedGame]
  );

  return (
    <GamesMenuAttribution>
      <MainMenuScreen
        screenId="games-main-menu"
        title={<Trans>Games</Trans>}
        subtitle={<Trans>Pick a game to play.</Trans>}
        helper={
          !isHost ? (
            <Trans>The host picks the game for this space.</Trans>
          ) : undefined
        }
        items={items}
      />
    </GamesMenuAttribution>
  );
}

/** FadeSwitch key when no game is selected (not user-facing copy). */
const GAMES_LIST_FADE_KEY = 'games-list';

function GamesMainMenuContent({
  games,
  selectedGame,
  onBackToGames,
}: {
  games: readonly GameClientDefinition[];
  selectedGame: SelectedGameId;
  onBackToGames: () => void;
}): ReactNode {
  if (selectedGame !== null) {
    const game = games.find((g) => g.id === selectedGame);
    if (game !== undefined) {
      const SelectedMenu = game.MainMenu;
      return <SelectedMenu onBackToGames={onBackToGames} />;
    }
  }
  return <GameListMenu games={games} />;
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
  const fadeKey = selectedGame ?? GAMES_LIST_FADE_KEY;

  return (
    <FadeSwitch stateKey={fadeKey}>
      <GamesMainMenuContent
        games={games}
        selectedGame={selectedGame}
        onBackToGames={onBackToGames}
      />
    </FadeSwitch>
  );
}
