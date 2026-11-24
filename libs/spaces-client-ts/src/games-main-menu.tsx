import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import type {
  GameClientDefinition,
  GameModeOption,
} from '@libs/spaces-shared-ts/game';
import type { SelectedGameId } from '@libs/spaces-shared-ts/games';
import { GamesRoomAttr } from '@libs/spaces-shared-ts/games';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { useLocalSearchParams } from '@pkgs/ui-root-client-ts/app-router';
import { Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from '@solidjs/web';
import { createEffect, createMemo, createSignal, on, Show, untrack } from 'solid-js';
import { useGamesRegistry } from './games-registry-context';
import { SpaceHomeScreenView } from './space-home-screen-view';
import { SPACE_GAME_PARAM } from './space-routes';
import { useSpaceSessionUi } from './space-session-ui-context';
import { useOfflineGameBrowse } from './use-offline-game-browse';
import { useSpaceCan } from './use-space-can';
import { useSpaceRoomSelector } from './use-space-room-selector';

/**
 * A space opened with `?game=<id>` (a puzzle link, …) starts that game for
 * its host at once, as picking it from the list would. Mounted while the
 * list shows, as the list itself was.
 */
function OpenLinkedGame(props: {
  readonly games: readonly GameClientDefinition[];
  readonly canSelectGame: boolean;
  readonly onSelectGame: (game: SelectedGameId) => void;
}): null {
  const params = useLocalSearchParams<{ game?: string | undefined }>();
  createEffect(() => {
    const game = params()[SPACE_GAME_PARAM];
    if (game === undefined || !props.canSelectGame) return;
    const linked = props.games.find((g) => g.id === game);
    if (linked !== undefined) untrack(() => props.onSelectGame(linked.id));
  });
  return null;
}

/** Every mode of `game`'s family, in the order registered; none for a game with one. */
export function gameModes(
  games: readonly GameClientDefinition[],
  game: GameClientDefinition
): readonly GameModeOption[] {
  const family = game.family ?? game.id;
  return games.flatMap((each) =>
    (each.family ?? each.id) === family && each.mode !== undefined
      ? [{ id: each.id, name: each.mode.name }]
      : []
  );
}

/** A guest tried to leave the host's game: only the host moves the space. */
function HostChoosesNotice(): JSX.Element {
  return (
    <Text variant="caption" testId={Handles.spaceHostChoosesGame}>
      <Trans>The host picks the game for this space.</Trans>
    </Text>
  );
}

/**
 * The body of `/space/:id`: the game choice ({@link SpaceHomeScreenView})
 * until the host picks a game, then that game's own menu. Wired to the
 * space room's selected game and the registry the composition root provides
 * via {@link GamesRegistryProvider}.
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
  const selectedMenu = createMemo(
    () => games.find((g) => g.id === shownGame()) ?? null
  );

  return (
    <Show
      when={selectedMenu()}
      keyed
      fallback={
        <>
          <OpenLinkedGame
            games={games}
            canSelectGame={canSelectGame()}
            onSelectGame={chooseGame}
          />
          <SpaceHomeScreenView
            games={games}
            canSelectGame={canSelectGame()}
            onSelectGame={chooseGame}
          />
        </>
      }
    >
      {(game) => (
        <>
          <Show when={hostChooses()}>
            <HostChoosesNotice />
          </Show>
          <game.MainMenu
            onBackToGames={onBackToGames}
            modes={gameModes(games, game)}
            onChooseMode={canSelectGame() ? chooseGame : undefined}
          />
        </>
      )}
    </Show>
  );
}
