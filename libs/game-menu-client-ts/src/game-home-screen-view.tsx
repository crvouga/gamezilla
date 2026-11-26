import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import {
  type GameMenuChoice,
  GameMenuScreen,
} from '@pkgs/ui-root-client-ts/game-menu-screen';
import type { GameTileMotif } from '@pkgs/ui-root-client-ts/game-tile';
import {
  CompassIcon,
  HistoryIcon,
  LightbulbIcon,
  ScrollTextIcon,
  SearchIcon,
  SettingsIcon,
  SquareStackIcon,
  UsersIcon,
} from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from '@solidjs/web';
import { createMemo, Match, Switch } from 'solid-js';
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
 * The quiet choices: looking back (history, puzzle stats), settings and
 * how to play. Every way to play weighs the same; the menu never
 * recommends one.
 */
export const GAME_CHOICE_EMPHASIS: Readonly<
  Record<string, 'quiet' | undefined>
> = {
  [SHARED_GAME_SCREEN.historyHome]: 'quiet',
  [SHARED_GAME_SCREEN.puzzleStats]: 'quiet',
  [SHARED_GAME_SCREEN.settings]: 'quiet',
  [HOW_TO_PLAY_CHOICE]: 'quiet',
};

/**
 * The picture each choice is known by: puzzles a bulb, a game's library a
 * stack, playing with friends or bots people, finding an opponent a search,
 * history and stats the clock turning back, settings the gear, how to play
 * the rules' scroll.
 */
const ICON: Readonly<Record<string, IconComponent>> = {
  [SHARED_GAME_SCREEN.puzzlesHome]: LightbulbIcon,
  // A game keeping only puzzle stats offers them as its History and stats.
  [SHARED_GAME_SCREEN.puzzleStats]: HistoryIcon,
  [SHARED_GAME_SCREEN.puzzlePacksHome]: SquareStackIcon,
  [SHARED_GAME_SCREEN.customGamesHome]: UsersIcon,
  [SHARED_GAME_SCREEN.matchmakingHome]: SearchIcon,
  [SHARED_GAME_SCREEN.historyHome]: HistoryIcon,
  [SHARED_GAME_SCREEN.settings]: SettingsIcon,
  [HOW_TO_PLAY_CHOICE]: ScrollTextIcon,
};

export type GameHomeScreenViewProps = {
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
    dataSet: { testid: Handles.gameChoice(choice.screen) },
    onClick,
  };
}

/** The game's choices, then how to play when the game says how. */
function GameMenuHub(props: GameHomeScreenViewProps): JSX.Element {
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
      screenId="game-home"
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
 * settings), each a row that leads onward; none is recommended.
 * How to play is a small place of its own behind the hub, opened by a row.
 * `GameMenu` decides which choices the game offers, opens the screen each
 * one names and keeps this device's place.
 */
export function GameHomeScreenView(
  props: GameHomeScreenViewProps
): JSX.Element {
  return (
    <Switch>
      <Match when={props.place.screen === 'home'}>
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
