import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { Trans } from '@lingui/solid/macro';
import { FadeSwitch } from '@pkgs/ui-client/fade-switch';
import type { MainMenuItem } from '@pkgs/ui-client/main-menu-item-row';
import { MainMenuScreen } from '@pkgs/ui-client/main-menu-screen';
import type { JSX } from 'solid-js';
import { createMemo, onMount, Show } from 'solid-js';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from './use-space-room-selector';
import { useSpaceCan } from './use-space-can';
import type { GameClientDefinition } from '@libs/spaces-shared/game';
import { GamesRoomAttr, SelectGame } from '@libs/spaces-shared/games';
import type { SelectedGameId } from '@libs/spaces-shared/games';
import { useSpaceSessionUi } from './space-session-ui-context';
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
    ...(game.caption !== undefined ? { caption: game.caption } : {}),
    dataSet: { testid: `game-menu-${game.id}` },
    selected: selectedGame === game.id,
    ...(isHost ? { onClick: () => onSelectGame(game.id) } : {}),
  }));
}

function GameListMenu(props: {
  games: readonly GameClientDefinition[];
}): JSX.Element {
  const { spaceId } = useSpaceSessionUi();
  const canSelectGame = useSpaceCan(spaceId, PERMISSION.spacesSelectGame);
  const selectedGame = useSpaceRoomSelector(GamesRoomAttr.selected.from);

  const dispatch = useSpaceRoomDispatch();
  const onSelectGame = (game: SelectedGameId): void => {
    dispatch(SelectGame({ game }));
  };

  // Warm each game's heavy assets while the picker is shown so selecting a
  // game does not block on a first-time load (no Suspense spinner on entry).
  onMount(() => {
    for (const game of props.games) game.preload?.();
  });

  const items = createMemo(() =>
    buildSpaceGameMenuItems(
      props.games,
      canSelectGame(),
      selectedGame(),
      onSelectGame
    )
  );

  return (
    <MainMenuScreen
      screenId="games-main-menu"
      title={<Trans>Games</Trans>}
      subtitle={<Trans>Pick a game to play.</Trans>}
      helper={
        !canSelectGame() ? (
          <Trans>The host picks the game for this space.</Trans>
        ) : undefined
      }
      items={items()}
    />
  );
}

/** FadeSwitch key when no game is selected (not user-facing copy). */
const GAMES_LIST_FADE_KEY = 'games-list';

/**
 * Top-level games menu for a space. Routes to the selected game's main menu
 * (via {@link GameClientDefinition.MainMenu}) or shows the game list when no
 * game is selected. Game registry is provided by the composition root via
 * {@link GamesRegistryProvider}.
 */
export function GamesMainMenu(): JSX.Element {
  const games = useGamesRegistry();
  const selectedGame = useSpaceRoomSelector(GamesRoomAttr.selected.from);
  const dispatch = useSpaceRoomDispatch();
  const onBackToGames = (): void => {
    dispatch(SelectGame({ game: null }));
  };
  const fadeKey = createMemo(() => selectedGame() ?? GAMES_LIST_FADE_KEY);
  const selectedMenu = createMemo(
    () => games.find((g) => g.id === selectedGame()) ?? null
  );

  return (
    <FadeSwitch stateKey={fadeKey()}>
      <Show
        when={selectedMenu()}
        keyed
        fallback={<GameListMenu games={games} />}
      >
        {(game) => <game.MainMenu onBackToGames={onBackToGames} />}
      </Show>
    </FadeSwitch>
  );
}
