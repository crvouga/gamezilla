import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import type { GameClientDefinition } from '@libs/spaces-shared/game';
import type { SelectedGameId } from '@libs/spaces-shared/games';
import { GamesRoomAttr, SelectGame } from '@libs/spaces-shared/games';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { useLocalSearchParams } from '@pkgs/ui-root-client/app-router';
import { FadeSwitch } from '@pkgs/ui-root-client/fade-switch';
import type { MainMenuItem } from '@pkgs/ui-root-client/main-menu-item-row';
import { MainMenuScreen } from '@pkgs/ui-root-client/main-menu-screen';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';
import {
  createEffect,
  createMemo,
  createSignal,
  onMount,
  Show,
  untrack,
} from 'solid-js';
import { useGamesRegistry } from './games-registry-context';
import { SPACE_GAME_PARAM } from './space-routes';
import { useSpaceSessionUi } from './space-session-ui-context';
import { useSpaceCan } from './use-space-can';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from './use-space-room-selector';

function HostChoosesNotice(): JSX.Element {
  return (
    <p
      class="text textCaption"
      {...dataAttrs({ testid: Handles.spaceHostChoosesGame })}
    >
      <Trans>The host picks the game for this space.</Trans>
    </p>
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

  // Warm each game's heavy assets while the picker is shown so selecting a
  // game does not block on a first-time load (no Suspense spinner on entry).
  onMount(() => {
    for (const game of props.games) game.preload?.();
  });

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

/** What this device shows before the space has accepted it. */
type LocalBrowse =
  | { kind: 'room' }
  | { kind: 'list' }
  | { kind: 'game'; game: SelectedGameId };

/**
 * Opening or leaving a game with no connection stays on this device.
 * Once the connection is back, that choice becomes the space's.
 */
function useOfflineGameBrowse(selectedGame: () => SelectedGameId | null): {
  shownGame: () => SelectedGameId | null;
  chooseGame: (game: SelectedGameId) => void;
  showList: () => void;
} {
  const dispatch = useSpaceRoomDispatch();
  const engine = useSyncEngine();
  const [local, setLocal] = createSignal<LocalBrowse>({ kind: 'room' });
  let promoting = false;
  createEffect(() => {
    const choice = local();
    const online = engine.status().online;
    const selected = selectedGame();
    if (!online || choice.kind === 'room') {
      promoting = false;
      return;
    }
    const game = choice.kind === 'list' ? null : choice.game;
    if (selected === game) {
      setLocal({ kind: 'room' });
      return;
    }
    if (promoting) return;
    promoting = true;
    dispatch(SelectGame({ game }));
  });
  return {
    shownGame: () => {
      const choice = local();
      if (choice.kind === 'list') return null;
      if (choice.kind === 'game') return choice.game;
      return selectedGame();
    },
    chooseGame: (game) => {
      if (!engine.status().online) {
        setLocal({ kind: 'game', game });
        return;
      }
      setLocal({ kind: 'room' });
      dispatch(SelectGame({ game }));
    },
    showList: () => {
      if (!engine.status().online) {
        setLocal({ kind: 'list' });
        return;
      }
      setLocal({ kind: 'room' });
      dispatch(SelectGame({ game: null }));
    },
  };
}

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
  const engine = useSyncEngine();
  const { spaceId } = useSpaceSessionUi();
  const canSelectGame = useSpaceCan(spaceId, PERMISSION.spacesSelectGame);
  const [hostChooses, setHostChooses] = createSignal(false);
  const onBackToGames = (): void => {
    if (!canSelectGame()) {
      if (engine.status().online) setHostChooses(true);
      return;
    }
    showList();
  };
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
