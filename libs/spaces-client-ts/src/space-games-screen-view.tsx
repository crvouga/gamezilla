import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Plural, Trans } from '@lingui/solid/macro';
import { FadeSwitch } from '@pkgs/ui-root-client-ts/fade-switch';
import type { MainMenuItem } from '@pkgs/ui-root-client-ts/main-menu-item-row';
import { MainMenuScreen } from '@pkgs/ui-root-client-ts/main-menu-screen';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { createMemo, Show } from 'solid-js';

/** One game the space can play, as the games list shows it. */
export type SpaceGameOption = {
  readonly id: string;
  readonly title: JSX.Element | string;
  readonly caption?: JSX.Element | string | undefined;
  /** How many play one game; shown beside the title (`2 players`, `Solo`). */
  readonly players?: number | undefined;
  /** The game's picture beside its title (a `GameTile`). */
  readonly Tile: (props: { readonly size?: 'md' | 'lg' }) => JSX.Element;
};

export type SpaceGamesScreenViewProps = {
  readonly games: readonly SpaceGameOption[];
  /** The game whose menu is shown, or null for the list. */
  readonly shownGame: string | null;
  /** The host picks the game; guests only see the list. */
  readonly canSelectGame: boolean;
  /** A guest tried to go back: say that the host picks the game. */
  readonly hostChoosesNotice: boolean;
  readonly onSelectGame: (gameId: string) => void;
  /** The shown game's own menu; games live outside spaces. */
  readonly renderGameMenu?: ((gameId: string) => JSX.Element) | undefined;
};

/** FadeSwitch key when no game is selected (not user-facing copy). */
const GAMES_LIST_FADE_KEY = 'games-list';

function HostChoosesNotice(): JSX.Element {
  return (
    <P variant="caption" testId={Handles.spaceHostChoosesGame}>
      <Trans>The host picks the game for this space.</Trans>
    </P>
  );
}

/** A game's player count as the tag beside its title. */
function PlayersTag(props: { readonly count: number }): JSX.Element {
  return (
    <Show when={props.count > 1} fallback={<Trans>Solo</Trans>}>
      <Plural value={props.count} one="# player" other="# players" />
    </Show>
  );
}

function GameListMenu(props: SpaceGamesScreenViewProps): JSX.Element {
  const items = createMemo((): MainMenuItem[] =>
    props.games.map((game) => ({
      key: game.id,
      title: game.title,
      ...(game.caption !== undefined ? { caption: game.caption } : {}),
      ...(game.players !== undefined
        ? { meta: <PlayersTag count={game.players} /> }
        : {}),
      leading: <game.Tile />,
      dataSet: { testid: `game-menu-${game.id}` },
      selected: props.shownGame === game.id,
      ...(props.canSelectGame
        ? { onClick: () => props.onSelectGame(game.id) }
        : {}),
    }))
  );
  return (
    <MainMenuScreen
      screenId="games-main-menu"
      title={<Trans>Games</Trans>}
      subtitle={<Trans>Pick a game to play.</Trans>}
      helper={!props.canSelectGame ? <HostChoosesNotice /> : undefined}
      items={items()}
    />
  );
}

/**
 * The body of `/space/:id` in a space, presentational: the games list (the
 * host picks, guests are told the host does) or the chosen game's menu,
 * crossfading between them. `GamesMainMenu` wires it to the space room.
 */
export function SpaceGamesScreenView(
  props: SpaceGamesScreenViewProps
): JSX.Element {
  const shown = createMemo(
    () => props.games.find((game) => game.id === props.shownGame)?.id ?? null
  );
  return (
    <>
      <Show when={props.hostChoosesNotice}>
        <HostChoosesNotice />
      </Show>
      <FadeSwitch stateKey={props.shownGame ?? GAMES_LIST_FADE_KEY}>
        <Show
          when={props.renderGameMenu !== undefined && shown()}
          keyed
          fallback={<GameListMenu {...props} />}
        >
          {(gameId) => props.renderGameMenu?.(gameId)}
        </Show>
      </FadeSwitch>
    </>
  );
}
