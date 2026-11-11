import MultiplayerScreen from '@libs/game-matchmaking-client-ts/multiplayer-screen';
import { ContentExperience } from '@libs/game-puzzle-client-ts/content-experience';
import { PuzzlePlayScreen } from '@libs/game-puzzle-client-ts/puzzle-play-screen';
import { PuzzleReviewScreen } from '@libs/game-puzzle-client-ts/puzzle-review-screen';
import { PuzzleStatsScreen } from '@libs/game-puzzle-client-ts/puzzle-stats-screen';
import { CustomGameScreen } from '@libs/game-session-client-ts/custom-game-screen';
import { GameHistory } from '@libs/game-session-client-ts/game-history';
import type { GameScreen } from '@libs/spaces-client-ts/use-game-screen';
import { Trans } from '@lingui/solid/macro';
import {
  type GameCapability,
  gameSides,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { JSX } from 'solid-js';
import type { GameClient } from './game-client';
import { GameSettingsScreen } from './game-settings-screen';
import { SHARED_GAME_SCREEN } from './shared-game-screens';

/**
 * The game's choices and the template screens they open, in the one order
 * every game shares. Which screens exist follows the capabilities the
 * game's registration declares and the settings it declares as data; every
 * one of them is the platform's.
 */

export type Offers = (capability: GameCapability) => boolean;

/** A template screen of the platform, by its key in the space. */
export type SharedScreen = {
  readonly screen: string;
  readonly Screen: () => JSX.Element;
};

/** A choice in the game's menu: the template screen it opens and how it reads. */
export type GameChoiceItem = {
  /** Its key in the space; also names its control (`game-choice-<screen>`). */
  readonly screen: string;
  /** Rendered where the choice is offered (copy is rendered, never built ahead). */
  readonly title: () => JSX.Element;
  readonly caption: () => JSX.Element;
};

export function sharedScreens(
  game: GameClient,
  offers: Offers,
  navigation: GameScreen
): readonly SharedScreen[] {
  const back = navigation.showChoices;
  const id = game.shared.id;
  const content = game.shared.puzzleContent;
  const contentClient = game.puzzleContent;
  const history = offers('history')
    ? { onHistory: () => navigation.show(SHARED_GAME_SCREEN.history) }
    : {};
  return [
    ...(contentClient === undefined || content === undefined
      ? []
      : [
          {
            screen: SHARED_GAME_SCREEN.content,
            Screen: () => (
              <ContentExperience
                gameId={id}
                title={game.title}
                content={content}
                client={contentClient}
                onBack={back}
              />
            ),
          },
        ]),
    ...(game.puzzles === undefined ? [] : PUZZLE_SCREENS),
    ...(offers('custom-games')
      ? [
          {
            screen: SHARED_GAME_SCREEN.customGames,
            Screen: () => (
              <CustomGameScreen
                gameId={id}
                title={game.title}
                onBack={back}
                {...history}
              />
            ),
          },
        ]
      : []),
    ...(offers('matchmaking')
      ? [
          {
            screen: SHARED_GAME_SCREEN.matchmaking,
            Screen: () => (
              <MultiplayerScreen gameId={id} title={game.title} onBack={back} />
            ),
          },
        ]
      : []),
    ...(offers('history')
      ? [
          {
            screen: SHARED_GAME_SCREEN.history,
            Screen: () => <GameHistory gameId={id} onBack={back} />,
          },
        ]
      : []),
    ...settingsScreen(game, back),
  ];
}

/** The settings template, for a game that declares settings. */
function settingsScreen(
  game: GameClient,
  back: () => void
): readonly SharedScreen[] {
  const settings = game.settings;
  if (settings === undefined) return [];
  return [
    {
      screen: SHARED_GAME_SCREEN.settings,
      Screen: () => (
        <GameSettingsScreen
          gameId={game.shared.id}
          settings={settings}
          onBack={back}
        />
      ),
    },
  ];
}

/** The platform's puzzle screens, for a game offering puzzles. */
const PUZZLE_SCREENS: readonly SharedScreen[] = [
  { screen: SHARED_GAME_SCREEN.puzzle, Screen: PuzzlePlayScreen },
  { screen: SHARED_GAME_SCREEN.puzzleStats, Screen: PuzzleStatsScreen },
  { screen: SHARED_GAME_SCREEN.puzzleReview, Screen: PuzzleReviewScreen },
];

const PUZZLE_CHOICES: readonly GameChoiceItem[] = [
  {
    screen: SHARED_GAME_SCREEN.puzzle,
    title: () => <Trans>Puzzle</Trans>,
    caption: () => <Trans>Solve rated puzzles and climb the ladder</Trans>,
  },
  {
    screen: SHARED_GAME_SCREEN.puzzleStats,
    title: () => <Trans>Puzzle stats</Trans>,
    caption: () => <Trans>Puzzle rating trend and game log</Trans>,
  },
];

function sharedChoices(game: GameClient, offers: Offers): GameChoiceItem[] {
  const name = game.title;
  const playerCount =
    game.shared.registration === undefined
      ? 1
      : gameSides(game.shared.registration.rules).length;
  return [
    ...(game.puzzleContent === undefined
      ? []
      : [
          {
            screen: SHARED_GAME_SCREEN.content,
            title: () => <Trans>Puzzles and packs</Trans>,
            caption: () => (
              <Trans>Play, continue saved attempts, or create your own</Trans>
            ),
          },
        ]),
    ...(game.puzzles === undefined ? [] : PUZZLE_CHOICES),
    ...(offers('custom-games')
      ? [
          {
            screen: SHARED_GAME_SCREEN.customGames,
            // Short enough to keep the lead's tag beside it on a phone's
            // row; the caption says bots are welcome too.
            title: () => <Trans>Play with friends</Trans>,
            // The game menu is always inside a space: its people are who
            // plays a custom game, beside any bots.
            caption: () => (
              <Trans>With the people in this space, or bots</Trans>
            ),
          },
        ]
      : []),
    ...(offers('matchmaking')
      ? [
          {
            screen: SHARED_GAME_SCREEN.matchmaking,
            title: () =>
              playerCount > 2 ? (
                <Trans>Find players</Trans>
              ) : (
                <Trans>Find an opponent</Trans>
              ),
            caption: () =>
              playerCount > 2 ? (
                <Trans>
                  Meet {playerCount - 1} other {name} players
                </Trans>
              ) : (
                <Trans>Meet another {name} player</Trans>
              ),
          },
        ]
      : []),
    ...(offers('history')
      ? [
          {
            screen: SHARED_GAME_SCREEN.history,
            title: () => <Trans>History and stats</Trans>,
            caption: () => <Trans>Review your games, wins and draws</Trans>,
          },
        ]
      : []),
  ];
}

/** Every choice the game offers, in the one order every game shares. */
export function gameChoices(
  game: GameClient,
  offers: Offers
): GameChoiceItem[] {
  return [
    ...sharedChoices(game, offers),
    ...(game.settings === undefined
      ? []
      : [
          {
            screen: SHARED_GAME_SCREEN.settings,
            title: () => <Trans>Settings</Trans>,
            caption: game.settings.caption,
          },
        ]),
  ];
}
