import { FindOpponentOffer } from '@libs/game-matchmaking-client-ts/find-opponent-offer';
import MultiplayerScreen from '@libs/game-matchmaking-client-ts/multiplayer-screen';
import { ContentExperience } from '@libs/game-puzzle-client-ts/content-experience';
import { PuzzlePlayScreen } from '@libs/game-puzzle-client-ts/puzzle-play-screen';
import { PuzzleReviewScreen } from '@libs/game-puzzle-client-ts/puzzle-review-screen';
import { PuzzleStatsScreen } from '@libs/game-puzzle-client-ts/puzzle-stats-screen';
import { CustomGameScreen } from '@libs/game-session-client-ts/custom-game-screen';
import { GameHistory } from '@libs/game-session-client-ts/game-history';
import type {
  GameScreen,
  VisitedGameScreen,
} from '@libs/spaces-client-ts/use-game-screen';
import { t } from '@lingui/core/macro';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import {
  type GameCapability,
  gameSides,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import type { GameClient } from './game-client';
import { GameHistoryHomeScreen } from './game-history-home-screen';
import { GameSettingsScreen } from './game-settings-screen';
import { SHARED_GAME_SCREEN } from './shared-game-screens';

/**
 * The game's choices and the template screens they open, in the one order
 * every game shares: finding an opponent, custom games, puzzles, History
 * and stats (every look back, games and puzzles alike), then settings. Which screens exist follows the capabilities the
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

/**
 * Whether History and stats is a hub: the game keeps both played games and
 * puzzle stats, each a screen of its own behind it.
 */
function historyHub(game: GameClient, offers: Offers): boolean {
  return offers('history') && game.puzzles !== undefined;
}

export function sharedScreens(
  game: GameClient,
  offers: Offers,
  navigation: VisitedGameScreen
): readonly SharedScreen[] {
  const back = navigation.showChoices;
  const id = game.shared.id;
  const content = game.shared.puzzleContent;
  const contentClient = game.puzzleContent;
  const hub = historyHub(game, offers);
  const toHub = () => navigation.show(SHARED_GAME_SCREEN.historyHome);
  const history = offers('history')
    ? { onHistory: () => navigation.show(gameHistoryScreen(hub)) }
    : {};
  return [
    ...(offers('matchmaking')
      ? [
          {
            screen: SHARED_GAME_SCREEN.matchmakingHome,
            Screen: () => (
              <MultiplayerScreen
                gameId={id}
                title={game.title}
                onBack={back}
                onBackFromBoard={navigation.backFromBoard}
              />
            ),
          },
        ]
      : []),
    ...(offers('custom-games')
      ? [
          {
            screen: SHARED_GAME_SCREEN.customGamesHome,
            Screen: () => (
              <CustomGameScreen
                gameId={id}
                title={game.title}
                onBack={back}
                onBackFromBoard={navigation.backFromBoard}
                {...history}
              />
            ),
          },
        ]
      : []),
    ...(contentClient === undefined || content === undefined
      ? []
      : [
          {
            screen: SHARED_GAME_SCREEN.puzzlePacksHome,
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
    ...(game.puzzles === undefined ? [] : puzzleScreens(hub, toHub)),
    ...historyScreens(game, offers, navigation),
    ...settingsScreen(game, back),
  ];
}

/** Where the games' history lives: behind the hub, or as History and stats. */
function gameHistoryScreen(hub: boolean): string {
  return hub ? SHARED_GAME_SCREEN.historyGames : SHARED_GAME_SCREEN.historyHome;
}

/** History and stats: the hub, when there is one, and the games' history. */
function historyScreens(
  game: GameClient,
  offers: Offers,
  navigation: GameScreen
): readonly SharedScreen[] {
  if (!offers('history')) return [];
  const id = game.shared.id;
  if (!historyHub(game, offers))
    return [
      {
        screen: SHARED_GAME_SCREEN.historyHome,
        Screen: () => (
          <GameHistory gameId={id} onBack={navigation.showChoices} />
        ),
      },
    ];
  return [
    {
      screen: SHARED_GAME_SCREEN.historyHome,
      Screen: () => (
        <GameHistoryHomeScreen
          onOpen={navigation.show}
          onBack={navigation.showChoices}
        />
      ),
    },
    {
      screen: SHARED_GAME_SCREEN.historyGames,
      Screen: () => (
        <GameHistory
          gameId={id}
          onBack={() => navigation.show(SHARED_GAME_SCREEN.historyHome)}
          backLabel={t`History and stats`}
        />
      ),
    },
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

/**
 * The platform's puzzle screens, for a game offering puzzles. Behind the
 * History and stats hub, Back from the stats returns to the hub.
 */
function puzzleScreens(hub: boolean, toHub: () => void): SharedScreen[] {
  return [
    { screen: SHARED_GAME_SCREEN.puzzlesHome, Screen: PuzzlePlayScreen },
    {
      screen: SHARED_GAME_SCREEN.puzzleStats,
      Screen: () =>
        hub ? (
          <PuzzleStatsScreen onBack={toHub} backLabel={t`History and stats`} />
        ) : (
          <PuzzleStatsScreen />
        ),
    },
    { screen: SHARED_GAME_SCREEN.puzzleReview, Screen: PuzzleReviewScreen },
  ];
}

/**
 * The one look back a game's menu offers: its played games and its puzzle
 * stats together, or whichever of them the game keeps.
 */
function historyChoice(game: GameClient, offers: Offers): GameChoiceItem[] {
  if (historyHub(game, offers))
    return [
      {
        screen: SHARED_GAME_SCREEN.historyHome,
        title: () => <Trans>History and stats</Trans>,
        caption: () => <Trans>Your games and puzzle stats</Trans>,
      },
    ];
  if (offers('history'))
    return [
      {
        screen: SHARED_GAME_SCREEN.historyHome,
        title: () => <Trans>History and stats</Trans>,
        caption: () => <Trans>Review your games, wins and draws</Trans>,
      },
    ];
  if (game.puzzles !== undefined)
    return [
      {
        screen: SHARED_GAME_SCREEN.puzzleStats,
        title: () => <Trans>History and stats</Trans>,
        caption: () => <Trans>Puzzle rating trend and game log</Trans>,
      },
    ];
  return [];
}

function sharedChoices(game: GameClient, offers: Offers): GameChoiceItem[] {
  const name = game.title;
  const playerCount =
    game.shared.registration === undefined
      ? 1
      : gameSides(game.shared.registration.rules).length;
  return [
    ...(offers('matchmaking')
      ? [
          {
            screen: SHARED_GAME_SCREEN.matchmakingHome,
            title: () => <Trans>Match making</Trans>,
            caption: () => (
              <FindOpponentOffer>
                <Show
                  when={game.mode === undefined}
                  fallback={<Trans>Find players for your chosen mode</Trans>}
                >
                  <Show
                    when={playerCount > 2}
                    fallback={<Trans>Meet another {name} player</Trans>}
                  >
                    <Trans>
                      Meet {playerCount - 1} other {name} players
                    </Trans>
                  </Show>
                </Show>
              </FindOpponentOffer>
            ),
          },
        ]
      : []),
    ...(offers('custom-games')
      ? [
          {
            screen: SHARED_GAME_SCREEN.customGamesHome,
            title: () => <Trans>Custom games</Trans>,
            // The game menu is always inside a space: its people are who
            // plays a custom game, beside any bots.
            caption: () => (
              <Trans>With the people in this space, or bots</Trans>
            ),
          },
        ]
      : []),
    ...(game.puzzleContent === undefined
      ? []
      : [
          {
            screen: SHARED_GAME_SCREEN.puzzlePacksHome,
            title: () => <Trans>Puzzles and packs</Trans>,
            caption: () => (
              <Trans>Play, continue saved attempts, or create your own</Trans>
            ),
          },
        ]),
    ...(game.puzzles === undefined
      ? []
      : [
          {
            screen: SHARED_GAME_SCREEN.puzzlesHome,
            title: () => <Trans>Puzzle</Trans>,
            caption: () => (
              <Trans>Solve rated puzzles and climb the ladder</Trans>
            ),
          },
        ]),
    ...historyChoice(game, offers),
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
