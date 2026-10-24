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
import type { GameChoice, GameClient, GameOwnScreen } from './game-client';
import { SHARED_GAME_SCREEN } from './shared-game-screens';

/**
 * The game's choices and the shared screens they open, in the one order
 * every game shares. Which shared screens exist follows the capabilities
 * the game's registration declares.
 */

export type Offers = (capability: GameCapability) => boolean;

export function sharedScreens(
  game: GameClient,
  offers: Offers,
  navigation: GameScreen
): readonly GameOwnScreen[] {
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
  ];
}

/** The platform's puzzle screens, for a game offering puzzles. */
const PUZZLE_SCREENS: readonly GameOwnScreen[] = [
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
  const playerCount = gameSides(game.shared.turnGame.rules).length;
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
            title: () => <Trans>Custom games</Trans>,
            caption: () => (
              <Trans>
                Choose people or bots for each of the {playerCount} places
              </Trans>
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

type GameChoiceItem = Omit<GameChoice, 'Screen'>;

/** Every choice the game offers, in the one order every game shares. */
export function gameChoices(
  game: GameClient,
  offers: Offers
): GameChoiceItem[] {
  return [
    ...(game.choices ?? []),
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
