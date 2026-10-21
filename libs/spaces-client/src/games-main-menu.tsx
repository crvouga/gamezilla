import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import type { GameClientDefinition } from '@libs/spaces-shared/game';
import type { SelectedGameId } from '@libs/spaces-shared/games';
import { GamesRoomAttr } from '@libs/spaces-shared/games';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { useLocalSearchParams } from '@pkgs/ui-root-client/app-router';
import { FadeSwitch } from '@pkgs/ui-root-client/fade-switch';
import type { MainMenuItem } from '@pkgs/ui-root-client/main-menu-item-row';
import { MainMenuScreen } from '@pkgs/ui-root-client/main-menu-screen';
import { P } from '@pkgs/ui-root-client/text';
import type { JSX } from 'solid-js';
import {
  createEffect,
  createMemo,
  createSignal,
  on,
  Show,
  untrack,
} from 'solid-js';
import { useGamesRegistry } from './games-registry-context';
import { SPACE_GAME_PARAM } from './space-routes';
import { useSpaceSessionUi } from './space-session-ui-context';
import { useOfflineGameBrowse } from './use-offline-game-browse';
import { useSpaceCan } from './use-space-can';
import { useSpaceRoomSelector } from './use-space-room-selector';

function HostChoosesNotice(): JSX.Element {
  return (
    <P variant="caption" testId={Handles.spaceHostChoosesGame}>
      <Trans>The host picks the game for this space.</Trans>
    </P>
  );
}

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

/**
 * A space opened with `?game=<id>` (a puzzle link, …) starts that game for
 * its host at once, as picking it from this list would.
 */
function useOpenLinkedGame(args: {
  games: () => readonly GameClientDefinition[];
  canSelectGame: () => boolean;
  onSelectGame: (game: SelectedGameId) => void;
}): void {
  const params = useLocalSearchParams<{ game?: string | undefined }>();
  createEffect(() => {
    const game = params()[SPACE_GAME_PARAM];
    if (game === undefined || !args.canSelectGame()) return;
    const linked = args.games().find((g) => g.id === game);
    if (linked !== undefined) untrack(() => args.onSelectGame(linked.id));
  });
}

function GameListMenu(props: {
  games: readonly GameClientDefinition[];
  selectedGame: SelectedGameId | null;
  chooseGame: (game: SelectedGameId) => void;
}): JSX.Element {
  const { spaceId } = useSpaceSessionUi();
  const canSelectGame = useSpaceCan(spaceId, PERMISSION.spacesSelectGame);
  const onSelectGame = (game: SelectedGameId): void => {
    props.chooseGame(game);
  };

  useOpenLinkedGame({
    games: () => props.games,
    canSelectGame,
    onSelectGame,
  });

  const items = createMemo(() =>
    buildSpaceGameMenuItems(
      props.games,
      canSelectGame(),
      props.selectedGame,
      onSelectGame
    )
  );

  return (
    <MainMenuScreen
      screenId="games-main-menu"
      title={<Trans>Games</Trans>}
      subtitle={<Trans>Pick a game to play.</Trans>}
      helper={!canSelectGame() ? <HostChoosesNotice /> : undefined}
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
  const { shownGame, chooseGame, showList } =
    useOfflineGameBrowse(selectedGame);
  const { spaceId } = useSpaceSessionUi();
  const canSelectGame = useSpaceCan(spaceId, PERMISSION.spacesSelectGame);
  const [hostChooses, setHostChooses] = createSignal(false);
  // A guest is told why going back did nothing, connected or not: only the
  // host moves the space. The answer belongs to the game it was given on.
  const onBackToGames = (): void => {
    if (!canSelectGame()) {
      setHostChooses(true);
      return;
    }
    showList();
  };
  createEffect(on(shownGame, () => setHostChooses(false), { defer: true }));
  const fadeKey = createMemo(() => shownGame() ?? GAMES_LIST_FADE_KEY);
  const selectedMenu = createMemo(
    () => games.find((g) => g.id === shownGame()) ?? null
  );

  return (
    <>
      <Show when={hostChooses()}>
        <HostChoosesNotice />
      </Show>
      <FadeSwitch stateKey={fadeKey()}>
        <Show
          when={selectedMenu()}
          keyed
          fallback={
            <GameListMenu
              games={games}
              selectedGame={shownGame()}
              chooseGame={chooseGame}
            />
          }
        >
          {(game) => <game.MainMenu onBackToGames={onBackToGames} />}
        </Show>
      </FadeSwitch>
    </>
  );
}
