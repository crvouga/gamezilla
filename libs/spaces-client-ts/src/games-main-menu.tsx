import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import type { SelectedGameId } from '@libs/spaces-shared-ts/games';
import { GamesRoomAttr } from '@libs/spaces-shared-ts/games';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { useLocalSearchParams } from '@pkgs/ui-root-client-ts/app-router';
import { FadeSwitch } from '@pkgs/ui-root-client-ts/fade-switch';
import { Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import {
  createEffect,
  createMemo,
  createSignal,
  on,
  Show,
  untrack,
} from 'solid-js';
import {
  type SpaceGameClient,
  useGamesRegistry,
} from './games-registry-context';
import { SpaceGameChoiceView } from './space-game-choice-view';
import { spaceGameFamilies } from './space-game-families';
import { SPACE_GAME_PARAM } from './space-routes';
import { SpaceScreenNotice, useSpaceScreenChrome } from './space-screen-chrome';
import { useSpaceSessionUi } from './space-session-ui-context';
import { useOfflineGameBrowse } from './use-offline-game-browse';
import { useSpaceCan } from './use-space-can';
import { useSpaceRoomSelector } from './use-space-room-selector';

/** FadeSwitch key while no game is chosen (not user-facing copy). */
const GAME_CHOICE_FADE_KEY = 'game-choice';

/**
 * A space opened with `?game=<id>` (a puzzle link, …) starts that game for
 * its host at once, as picking it would. Mounted while the game choice
 * shows.
 */
function OpenLinkedGame(props: {
  readonly games: readonly SpaceGameClient[];
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

/** A guest pressed back in the host's game: only the host moves the space. */
function HostChoosesNotice(): JSX.Element {
  return (
    <Text variant="caption" testId={Handles.spaceHostChoosesGame}>
      <Trans>The host picks the game for this space.</Trans>
    </Text>
  );
}

/**
 * The game choice in the space's own shell: {@link SpaceGameChoiceView}
 * with the space's chrome (the view claims the shell).
 */
function GameChoice(props: {
  readonly games: readonly SpaceGameClient[];
  readonly canSelectGame: boolean;
  readonly onSelectGame: (game: SelectedGameId) => void;
}): JSX.Element {
  const chrome = useSpaceScreenChrome();
  const families = createMemo(() => spaceGameFamilies(props.games));
  return (
    <>
      <OpenLinkedGame
        games={props.games}
        canSelectGame={props.canSelectGame}
        onSelectGame={props.onSelectGame}
      />
      <SpaceGameChoiceView
        chrome={chrome}
        notice={<SpaceScreenNotice />}
        families={families()}
        canChoose={props.canSelectGame}
        onChoose={props.onSelectGame}
      />
    </>
  );
}

/**
 * Top-level games of a space: the game choice while the space's room has
 * none selected, else the selected game's own menu. Games come from the
 * registry the composition root provides via {@link GamesRegistryProvider}.
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
  const shown = createMemo(
    () => games.find((g) => g.id === shownGame()) ?? null
  );

  return (
    <FadeSwitch stateKey={shown()?.id ?? GAME_CHOICE_FADE_KEY}>
      <Show
        when={shown()}
        keyed
        fallback={
          <GameChoice
            games={games}
            canSelectGame={canSelectGame()}
            onSelectGame={chooseGame}
          />
        }
      >
        {(game) => (
          <>
            <Show when={hostChooses()}>
              <HostChoosesNotice />
            </Show>
            <game.MainMenu onBackToGames={onBackToGames} />
          </>
        )}
      </Show>
    </FadeSwitch>
  );
}
