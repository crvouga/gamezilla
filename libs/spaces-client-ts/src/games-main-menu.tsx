import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import type { GameClientDefinition } from '@libs/spaces-shared-ts/game';
import type { SelectedGameId } from '@libs/spaces-shared-ts/games';
import { GamesRoomAttr } from '@libs/spaces-shared-ts/games';
import { useLocalSearchParams } from '@pkgs/ui-root-client-ts/app-router';
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
import { SpaceGamesScreenView } from './space-games-screen-view';
import { SPACE_GAME_PARAM } from './space-routes';
import { useSpaceSessionUi } from './space-session-ui-context';
import { useConnectedSpaceRoster } from './use-connected-space-roster';
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

/**
 * Top-level games menu for a space: wires {@link SpaceGamesScreenView} to
 * the space room's selected game and the registry the composition root
 * provides via {@link GamesRegistryProvider}.
 */
export function GamesMainMenu(): JSX.Element {
  const games = useGamesRegistry();
  const selectedGame = useSpaceRoomSelector(GamesRoomAttr.selected.from);
  const { shownGame, chooseGame, showList } =
    useOfflineGameBrowse(selectedGame);
  const { spaceId } = useSpaceSessionUi();
  const canSelectGame = useSpaceCan(spaceId, PERMISSION.spacesSelectGame);
  const [hostChooses, setHostChooses] = createSignal(false);
  // Everyone here: a game seats some of them, the rest watch it.
  const roster = useConnectedSpaceRoster();
  const present = createMemo(
    () => new Set(roster().map((person) => person.id)).size
  );
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
    <>
      <Show when={selectedMenu() === null}>
        <OpenLinkedGame
          games={games}
          canSelectGame={canSelectGame()}
          onSelectGame={chooseGame}
        />
      </Show>
      <SpaceGamesScreenView
        games={games}
        shownGame={shownGame()}
        canSelectGame={canSelectGame()}
        present={present()}
        hostChoosesNotice={hostChooses()}
        onSelectGame={chooseGame}
        renderGameMenu={(gameId) => {
          const game = games.find((g) => g.id === gameId);
          return game === undefined ? null : (
            <game.MainMenu onBackToGames={onBackToGames} />
          );
        }}
      />
    </>
  );
}
