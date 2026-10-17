import type { GameClientDefinition } from '@libs/spaces-shared/game';
import type { GamePresentation } from '@pkgs/turn-game-shared/game-presentation';
import type { JSX } from 'solid-js';
import { GameMenu } from './game-menu';
import { assertGameScreens } from './shared-game-screens';

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
  readonly presentation: GamePresentation<JSX.Element>;
  /** The game's own choices, offered before the shared ones. */
  readonly choices?: readonly GameChoice[];
  /** The game's settings, offered last under the shared name. */
  readonly settings?: Omit<GameChoice, 'screen' | 'title'>;
  /** Further screens the game's own screens and links open. */
  readonly screens?: readonly GameOwnScreen[];
  /** Wraps every screen of the game (shared data the game's screens read). */
  readonly Frame?: (props: { children: JSX.Element }) => JSX.Element;
  readonly SessionEffects?: () => JSX.Element;
  readonly preload?: () => void;
};

/** The one way a game joins the space's game choice. */
export function defineGameClient(game: GameClient): GameClientDefinition {
  assertGameScreens(game.id, [
    ...(game.choices ?? []).map((choice) => choice.screen),
    ...(game.screens ?? []).map((screen) => screen.screen),
  ]);
  return {
    id: game.id,
    title: game.title,
    caption: game.caption,
    presentation: game.presentation,
    MainMenu: (props) => (
      <GameMenu game={game} onBackToGames={props.onBackToGames} />
    ),
    ...(game.SessionEffects === undefined
      ? {}
      : { SessionEffects: game.SessionEffects }),
    ...(game.preload === undefined ? {} : { preload: game.preload }),
  };
}
