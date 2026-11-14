import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import {
  type GameMenuChoice,
  GameMenuScreen,
} from '@pkgs/ui-root-client-ts/game-menu-screen';
import type { GameRulesSection } from '@pkgs/ui-root-client-ts/game-rules-screen';
import type { GameTileMotif } from '@pkgs/ui-root-client-ts/game-tile';
import {
  ActivityIcon,
  CompassIcon,
  HistoryIcon,
  LightbulbIcon,
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

/** How to play's button names its control like a choice. */
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
 * and puzzles ordinary ways to play, and looking back (history, puzzle
 * stats) and settings the quiet ones, grouped apart under "More".
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
 * the gear.
 */
const ICON: Readonly<Record<string, IconComponent>> = {
  [SHARED_GAME_SCREEN.puzzle]: LightbulbIcon,
  [SHARED_GAME_SCREEN.puzzleStats]: ActivityIcon,
  [SHARED_GAME_SCREEN.content]: SquareStackIcon,
  [SHARED_GAME_SCREEN.customGames]: UsersIcon,
  [SHARED_GAME_SCREEN.matchmaking]: SearchIcon,
  [SHARED_GAME_SCREEN.history]: HistoryIcon,
  [SHARED_GAME_SCREEN.settings]: SettingsIcon,
};

export type GameMenuScreenViewProps = {
  /** The game's name. */
  readonly title: string;
  /** The game's picture (its `GameTile` motif), before its name. */
  readonly tile: GameTileMotif;
  /** One line under the name: what the game is. */
  readonly subtitle: JSX.Element;
  /**
   * How to play, in the game's own words, part by part. The menu offers it
   * under the game's name and shows it on the `how-to-play` place; a game
   * that says nothing has neither.
   */
  readonly instructions?: readonly GameRulesSection[] | undefined;
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
    dataSet: { testid: Handles.gameChoice(choice.screen) },
    onClick,
  };
}

/** The game's choices, with how to play under its name when the game says how. */
function GameMenuHub(props: GameMenuScreenViewProps): JSX.Element {
  const choices = createMemo((): GameMenuChoice[] =>
    props.choices.map((choice) =>
      menuChoice(choice, () => props.onChoose(choice.screen))
    )
  );
  return (
    <GameMenuScreen
      screenId="game-choices"
      dataSet={{ testid: Handles.gameChoices }}
      title={props.title}
      motif={props.tile}
      subtitle={props.subtitle}
      groups={{ play: <Trans>Play</Trans>, more: <Trans>More</Trans> }}
      howToPlay={
        props.instructions === undefined
          ? undefined
          : {
              label: <Trans>How to play</Trans>,
              onClick: () => props.onOpen({ screen: 'how-to-play' }),
              dataSet: { testid: Handles.gameChoice(HOW_TO_PLAY_CHOICE) },
            }
      }
      choices={choices()}
    />
  );
}

/** The menu's main way in, which the rules lead on to: the first way to play. */
function mainWayIn(
  choices: readonly GameMenuChoiceView[]
): GameMenuChoiceView | undefined {
  return (
    choices.find((c) => GAME_CHOICE_EMPHASIS[c.screen] === 'primary') ??
    choices.find((c) => GAME_CHOICE_EMPHASIS[c.screen] !== 'quiet')
  );
}

/**
 * A game's menu in a space, presentational: a hub of the template screens
 * the game offers (puzzles, custom games, finding an opponent, history,
 * settings), each a row that leads onward, the ways to play apart from the
 * rest, with one emphasised way in. How to play is a small place of its own
 * behind the hub, opened from under the game's name, and leads on to the
 * main way in.
 * `GameMenu` decides which choices the game offers, opens the screen each
 * one names and keeps this device's place.
 */
export function GameMenuScreenView(
  props: GameMenuScreenViewProps
): JSX.Element {
  const play = createMemo(() => {
    const way = mainWayIn(props.choices);
    return way === undefined
      ? undefined
      : {
          title: way.title,
          // The menu is home again once the game is left.
          onClick: () => {
            props.onOpen({ screen: 'menu' });
            props.onChoose(way.screen);
          },
        };
  });
  return (
    <Switch>
      <Match when={props.place.screen === 'menu'}>
        <GameMenuHub {...props} />
      </Match>
      <Match when={props.place.screen === 'how-to-play'}>
        <GameHowToPlayView
          title={props.title}
          tile={props.tile}
          subtitle={props.subtitle}
          rules={props.instructions ?? []}
          play={play()}
          onBack={() => props.onOpen({ screen: 'menu' })}
        />
      </Match>
    </Switch>
  );
}
