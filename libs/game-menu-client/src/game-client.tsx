import type { GameClientDefinition } from '@libs/spaces-shared/game';
import type { GamePresentation } from '@pkgs/turn-game-shared/game-presentation';
import type { JSX } from 'solid-js';
import { GameMenu } from './game-menu';
import { assertGameScreens } from './shared-game-screens';

/** How the shared screens show the game: its board, side names and endings. */
export type GameClientPresentation = Omit<GamePresentation<JSX.Element>, 'id'>;

/** A screen the game renders itself, shown to everyone in the space. */
export type GameOwnScreen = {
  /** Its key in the space; a choice's key also names its control (`game-choice-<screen>`). */
  readonly screen: string;
  readonly Screen: () => JSX.Element;
};

/** One of a game's own choices: how it is offered and the screen it opens. */
export type GameChoice = GameOwnScreen & {
  /** Rendered where the choice is offered (copy is rendered, never built ahead). */
  readonly title: () => JSX.Element;
  readonly caption: () => JSX.Element;
};

/**
 * Everything a game supplies to the shared game experience. The platform
 * owns the menu, its order, the custom-game, opponent and history screens,
 * the space-wide navigation and links; a game adds only what is unique.
 * Which shared screens appear follows the capabilities the game's shared
 * registration declares, so nothing here repeats them.
 */
export type GameClient = {
  readonly id: string;
  /** The game's name, in the game choice and above its own choices. */
  readonly title: string;
  /** One line under the name in the game choice. */
  readonly caption: string;
  /** One line under the name above the game's choices. */
  readonly subtitle: () => JSX.Element;
  /** How to play, under the game's choices. */
  readonly instructions?: () => JSX.Element;
  readonly presentation: GameClientPresentation;
  /** The game's own choices, offered before the shared ones. */
  readonly choices?: readonly GameChoice[];
  /** The game's settings, offered last under the shared name. */
  readonly settings?: Omit<GameChoice, 'screen' | 'title'>;
  /** Further screens the game's own screens and links open. */
  readonly screens?: readonly GameOwnScreen[];
  /** Wraps every screen of the game (shared data the game's screens read). */
  readonly Frame?: (props: { children: JSX.Element }) => JSX.Element;
  readonly SessionEffects?: () => JSX.Element;
};

/**
 * A game's client as the client registry lists it. Only
 * {@link defineGameClient} makes one: its private brand is not copied by a
 * spread or met by a hand-built object, so a registered client always has
 * its screens checked and is offered through the one `GameMenu`.
 */
class DefinedGameClient implements GameClientDefinition {
  readonly #defined = true;
  readonly id: string;
  readonly title: string;
  readonly caption: string;
  readonly presentation: GamePresentation<JSX.Element>;
  readonly MainMenu: GameClientDefinition['MainMenu'];
  declare readonly SessionEffects?: () => JSX.Element;

  constructor(game: GameClient) {
    this.id = game.id;
    this.title = game.title;
    this.caption = game.caption;
    this.presentation = { ...game.presentation, id: game.id };
    this.MainMenu = (props) => (
      <GameMenu game={game} onBackToGames={props.onBackToGames} />
    );
    if (game.SessionEffects !== undefined)
      this.SessionEffects = game.SessionEffects;
  }

  /** Whether `value` was made by {@link defineGameClient}. */
  static made(value: unknown): value is DefinedGameClient {
    return typeof value === 'object' && value !== null && #defined in value;
  }
}

export type GameClientRegistration = DefinedGameClient;

/** The one way a game joins the space's game choice. */
export function defineGameClient(game: GameClient): GameClientRegistration {
  assertGameScreens(game.id, [
    ...(game.choices ?? []).map((choice) => choice.screen),
    ...(game.screens ?? []).map((screen) => screen.screen),
  ]);
  return new DefinedGameClient(game);
}

/**
 * Fail, naming the entry, when a registry lists a client
 * {@link defineGameClient} did not make (a copy, a hand-built object).
 */
export function assertGameClientDefinitions(
  registry: string,
  clients: readonly unknown[]
): void {
  for (const [index, client] of clients.entries()) {
    if (DefinedGameClient.made(client)) continue;
    const id =
      typeof client === 'object' && client !== null && 'id' in client
        ? String(client.id)
        : '?';
    throw new Error(
      `${registry}[${String(index)}] (${id}) was not made by defineGameClient — register the game's defineGameClient(...) value itself, never a copy or a hand-built client`
    );
  }
}
