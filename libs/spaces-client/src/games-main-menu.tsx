import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import type { GameClientDefinition } from '@libs/spaces-shared/game';
import type { SelectedGameId } from '@libs/spaces-shared/games';
import { GamesRoomAttr, SelectGame } from '@libs/spaces-shared/games';
import { Trans } from '@lingui/solid/macro';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { useLocalSearchParams } from '@pkgs/ui-root-client/app-router';
import { FadeSwitch } from '@pkgs/ui-root-client/fade-switch';
import type { MainMenuItem } from '@pkgs/ui-root-client/main-menu-item-row';
import { MainMenuScreen } from '@pkgs/ui-root-client/main-menu-screen';
import type { JSX } from 'solid-js';
import {
  createEffect,
  createMemo,
  createSignal,
  onMount,
  Show,
  untrack,
} from 'solid-js';
import { GameChoiceRefusedNotice } from './game-choice-refused-notice';
import { useGamesRegistry } from './games-registry-context';
import { SPACE_GAME_PARAM } from './space-routes';
import { useSpaceSessionUi } from './space-session-ui-context';
import { useSpaceCan } from './use-space-can';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from './use-space-room-selector';

function buildSpaceGameMenuItems(
  games: readonly GameClientDefinition[],
  selectedGame: SelectedGameId,
  onSelectGame: (game: SelectedGameId) => void
): MainMenuItem[] {
  return games.map((game) => ({
    key: game.id,
    title: game.title,
    ...(game.caption !== undefined ? { caption: game.caption } : {}),
    dataSet: { testid: `game-menu-${game.id}` },
    selected: selectedGame === game.id,
    onClick: () => onSelectGame(game.id),
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
  onRefused: () => void;
}): JSX.Element {
  const { spaceId } = useSpaceSessionUi();
  const canSelectGame = useSpaceCan(spaceId, PERMISSION.spacesSelectGame);
  const selectedGame = useSpaceRoomSelector(GamesRoomAttr.selected.from);
  const engine = useSyncEngine();

  const dispatch = useSpaceRoomDispatch();
  const onSelectGame = (game: SelectedGameId): void => {
    if (!engine.status().online) return;
    if (!canSelectGame()) {
      props.onRefused();
      return;
    }
    dispatch(SelectGame({ game }));
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
    buildSpaceGameMenuItems(props.games, selectedGame(), onSelectGame)
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
  const { spaceId } = useSpaceSessionUi();
  const canSelectGame = useSpaceCan(spaceId, PERMISSION.spacesSelectGame);
  const engine = useSyncEngine();
  const [refused, setRefused] = createSignal(false);
  const onBackToGames = (): void => {
    if (!engine.status().online) return;
    if (!canSelectGame()) {
      setRefused(true);
      return;
    }
    dispatch(SelectGame({ game: null }));
  };
  const fadeKey = createMemo(() => selectedGame() ?? GAMES_LIST_FADE_KEY);
  const selectedMenu = createMemo(
    () => games.find((g) => g.id === selectedGame()) ?? null
  );

  return (
    <div class="box gap-3">
      <Show when={refused()}>
        <GameChoiceRefusedNotice />
      </Show>
      <FadeSwitch stateKey={fadeKey()}>
        <Show
          when={selectedMenu()}
          keyed
          fallback={
            <GameListMenu games={games} onRefused={() => setRefused(true)} />
          }
        >
          {(game) => <game.MainMenu onBackToGames={onBackToGames} />}
        </Show>
      </FadeSwitch>
    </div>
  );
}
