import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import {
  type GameMenuChoice,
  GameMenuScreen,
} from '@pkgs/ui-root-client-ts/game-menu-screen';
import type { GameTileMotif } from '@pkgs/ui-root-client-ts/game-tile';
import {
  ActivityIcon,
  CompassIcon,
  HistoryIcon,
  LightbulbIcon,
  PlayIcon,
  SearchIcon,
  SettingsIcon,
  SquareStackIcon,
  UsersIcon,
} from '@pkgs/ui-root-client-ts/icons';
import type { MainMenuItem } from '@pkgs/ui-root-client-ts/main-menu-item-row';
import { createMemo, type JSX } from 'solid-js';
import { SHARED_GAME_SCREEN } from './shared-game-screens';

/** One choice in a game's menu: the screen it opens and how it reads. */
export type GameMenuChoiceView = {
  /** Its key in the space; also names its control (`game-choice-<screen>`). */
  readonly screen: string;
  readonly title: JSX.Element;
  readonly caption: JSX.Element;
};

/**
 * How strongly each choice asks to be chosen: playing with friends or bots
 * is the main way in, finding an opponent an ordinary one, and looking
 * back (history, puzzle stats) or settings the quiet ones.
 */
export const GAME_CHOICE_EMPHASIS: Readonly<
  Record<string, MainMenuItem['emphasis']>
> = {
  [SHARED_GAME_SCREEN.customGames]: 'primary',
  [SHARED_GAME_SCREEN.history]: 'quiet',
  [SHARED_GAME_SCREEN.puzzleStats]: 'quiet',
  [SHARED_GAME_SCREEN.settings]: 'quiet',
};

/**
 * The picture each choice is known by: puzzles a bulb, their stats a
 * trend, a game's library a stack, playing with friends or bots people,
 * finding an opponent a search, history the clock turning back, settings
 * the gear. A game's own choice gets a compass, or a play mark.
 */
const ICON: Readonly<Record<string, IconComponent>> = {
  [SHARED_GAME_SCREEN.puzzle]: LightbulbIcon,
  [SHARED_GAME_SCREEN.puzzleStats]: ActivityIcon,
  [SHARED_GAME_SCREEN.content]: SquareStackIcon,
  [SHARED_GAME_SCREEN.customGames]: UsersIcon,
  [SHARED_GAME_SCREEN.matchmaking]: SearchIcon,
  [SHARED_GAME_SCREEN.history]: HistoryIcon,
  [SHARED_GAME_SCREEN.settings]: SettingsIcon,
  play: PlayIcon,
};

export type GameMenuScreenViewProps = {
  /** The game's name. */
  readonly title: string;
  /** The game's picture (its `GameTile` motif), before its name. */
  readonly tile: GameTileMotif;
  /** One line under the name. */
  readonly subtitle: JSX.Element;
  /** How to play, under the choices. */
  readonly instructions?: JSX.Element | undefined;
  /** The game's own choices, then the shared ones, in the one order every game shares. */
  readonly choices: readonly GameMenuChoiceView[];
  readonly onChoose: (screen: string) => void;
};

/**
 * A game's menu in a space, presentational: its name, its own and the
 * shared choices (puzzles, custom games, finding an opponent, history,
 * settings) and how to play. `GameMenu` decides which choices the game
 * offers and opens the screen each one names.
 */
export function GameMenuScreenView(
  props: GameMenuScreenViewProps
): JSX.Element {
  const choices = createMemo((): GameMenuChoice[] =>
    props.choices.map((choice) => ({
      key: choice.screen,
      title: choice.title,
      caption: choice.caption,
      icon: ICON[choice.screen] ?? CompassIcon,
      emphasis: GAME_CHOICE_EMPHASIS[choice.screen],
      // The main way in says why it leads, in words, on every size.
      badge:
        GAME_CHOICE_EMPHASIS[choice.screen] === 'primary' ? (
          <Trans>Recommended</Trans>
        ) : undefined,
      dataSet: { testid: Handles.gameChoice(choice.screen) },
      onClick: () => props.onChoose(choice.screen),
    }))
  );
  return (
    <GameMenuScreen
      screenId="game-choices"
      dataSet={{ testid: Handles.gameChoices }}
      title={props.title}
      motif={props.tile}
      subtitle={props.subtitle}
      description={props.instructions}
      choices={choices()}
    />
  );
}
