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
  ScrollTextIcon,
  SearchIcon,
  SettingsIcon,
  SquareStackIcon,
  UsersIcon,
} from '@pkgs/ui-root-client-ts/icons';
import type { MainMenuItem } from '@pkgs/ui-root-client-ts/main-menu-item-row';
import { createMemo, type JSX, Match, Switch } from 'solid-js';
import { GameHowToPlayView } from './game-how-to-play-view';
import type { GameMenuPlace } from './game-menu-places';
import { SHARED_GAME_SCREEN } from './shared-game-screens';

/** The row that opens how to play; it names its control like a choice. */
export const HOW_TO_PLAY_CHOICE = 'how-to-play';

/** One choice in a game's menu: the screen it opens and how it reads. */
export type GameMenuChoiceView = {
  /** Its key in the space; also names its control (`game-choice-<screen>`). */
  readonly screen: string;
  readonly title: JSX.Element;
  readonly caption: JSX.Element;
};

/**
 * How strongly each choice asks to be chosen: playing with friends or bots
 * is the main way in (the menu's one emphasised row), finding an opponent
 * an ordinary one, and looking back (history, puzzle stats), settings or
 * how to play the quiet ones.
 */
export const GAME_CHOICE_EMPHASIS: Readonly<
  Record<string, MainMenuItem['emphasis']>
> = {
  [SHARED_GAME_SCREEN.customGames]: 'primary',
  [SHARED_GAME_SCREEN.history]: 'quiet',
  [SHARED_GAME_SCREEN.puzzleStats]: 'quiet',
  [SHARED_GAME_SCREEN.settings]: 'quiet',
  [HOW_TO_PLAY_CHOICE]: 'quiet',
};

/**
 * The picture each choice is known by: puzzles a bulb, their stats a
 * trend, a game's library a stack, playing with friends or bots people,
 * finding an opponent a search, history the clock turning back, settings
 * the gear, how to play the rules' scroll.
 */
const ICON: Readonly<Record<string, IconComponent>> = {
  [SHARED_GAME_SCREEN.puzzle]: LightbulbIcon,
  [SHARED_GAME_SCREEN.puzzleStats]: ActivityIcon,
  [SHARED_GAME_SCREEN.content]: SquareStackIcon,
  [SHARED_GAME_SCREEN.customGames]: UsersIcon,
  [SHARED_GAME_SCREEN.matchmaking]: SearchIcon,
  [SHARED_GAME_SCREEN.history]: HistoryIcon,
  [SHARED_GAME_SCREEN.settings]: SettingsIcon,
  [HOW_TO_PLAY_CHOICE]: ScrollTextIcon,
};

export type GameMenuScreenViewProps = {
  /** The game's name. */
  readonly title: string;
  /** The game's picture (its `GameTile` motif), before its name. */
  readonly tile: GameTileMotif;
  /** One line under the name: what the game is. */
  readonly subtitle: JSX.Element;
  /**
   * How to play, in the game's own words. The menu offers it as a row and
   * shows it on the `how-to-play` place; a game that says nothing has
   * neither.
   */
  readonly instructions?: JSX.Element | undefined;
  /** The template screens the game offers, in the one order every game shares. */
  readonly choices: readonly GameMenuChoiceView[];
  readonly onChoose: (screen: string) => void;
  /** The small screen this device shows: the choices, or how to play. */
  readonly place: GameMenuPlace;
  readonly onOpen: (place: GameMenuPlace) => void;
};

/** One row of the menu as `GameMenuScreen` draws it. */
function menuChoice(
  choice: GameMenuChoiceView,
  onClick: () => void
): GameMenuChoice {
  return {
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
    onClick,
  };
}

/** The game's choices, then how to play when the game says how. */
function GameMenuHub(props: GameMenuScreenViewProps): JSX.Element {
  const choices = createMemo((): GameMenuChoice[] => [
    ...props.choices.map((choice) =>
      menuChoice(choice, () => props.onChoose(choice.screen))
    ),
    ...(props.instructions === undefined
      ? []
      : [
          menuChoice(
            {
              screen: HOW_TO_PLAY_CHOICE,
              title: <Trans>How to play</Trans>,
              caption: <Trans>The rules, in a few lines</Trans>,
            },
            () => props.onOpen({ screen: 'how-to-play' })
          ),
        ]),
  ]);
  return (
    <GameMenuScreen
      screenId="game-choices"
      dataSet={{ testid: Handles.gameChoices }}
      title={props.title}
      motif={props.tile}
      subtitle={props.subtitle}
      choices={choices()}
    />
  );
}

/**
 * A game's menu in a space, presentational: a hub of the template screens
 * the game offers (puzzles, custom games, finding an opponent, history,
 * settings), each a row that leads onward, with one emphasised way in.
 * How to play is a small place of its own behind the hub, opened by a row.
 * `GameMenu` decides which choices the game offers, opens the screen each
 * one names and keeps this device's place.
 */
export function GameMenuScreenView(
  props: GameMenuScreenViewProps
): JSX.Element {
  return (
    <Switch>
      <Match when={props.place.screen === 'menu'}>
        <GameMenuHub {...props} />
      </Match>
      <Match when={props.place.screen === 'how-to-play'}>
        <GameHowToPlayView
          title={props.title}
          instructions={props.instructions}
        />
      </Match>
    </Switch>
  );
}
