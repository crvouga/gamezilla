import { ACCOUNT_PRIVACY_HARNESS_SLICE } from '@libs/account-privacy-harness/account-privacy-harness-slice';
import { BILLING_HARNESS_SLICE } from '@libs/billing-harness/billing-harness-slice';
import { FRIENDS_HARNESS_SLICE } from '@libs/friends-harness/friends-harness-slice';
import { FRIENDS_BLOCK_RELATION } from '@libs/friends-shared/block-relation';
import { createMultiplayerLinkClient } from '@libs/game-matchmaking-client/multiplayer-link-client';
import { MATCHED_GAME_HARNESS_ACTIONS } from '@libs/game-matchmaking-harness/matched-game-actions';
import { withOpponentSearchCleanup } from '@libs/game-matchmaking-harness/opponent-search-cleanup';
import { OPPONENT_SEEKING_ACTIONS } from '@libs/game-matchmaking-harness/opponent-seeking';
import { createPersonalPuzzleStatsClients } from '@libs/game-menu-client/personal-puzzle-stats-clients';
import { createPuzzleLinkClient } from '@libs/game-puzzle-client/puzzle-link-client';
import { GAME_PUZZLE_SERVER } from '@libs/game-puzzle-shared/puzzle-sub-server';
import { gamePuzzleSubs } from '@libs/game-puzzle-shared/sub';
import { createGameSessionServer } from '@libs/game-session-server/sub-server';
import { createGameSessionSub } from '@libs/game-session-shared/sub';
import { defineProductSystem } from '@libs/harness/define-product-system';
import type { OpenHarnessOptions } from '@libs/harness/mode';
import type { OpenHarness } from '@libs/harness/open-harness';
import { openHarness } from '@libs/harness/open-harness';
import type { HarnessSlice } from '@libs/harness/slices';
import { composeHarnessSlices } from '@libs/harness/slices';
import { NOTIFICATIONS_HARNESS_SLICE } from '@libs/notifications-harness/notifications-harness-slice';
import { PROFILE_HARNESS_SLICE } from '@libs/profile-harness/profile-harness-slice';
import { SEARCH_HARNESS_SLICE } from '@libs/search-harness/search-harness-slice';
import { spacesHarnessSlice } from '@libs/spaces-harness/spaces-harness-slice';
import { createTurnGames } from '@pkgs/turn-game-shared/game-rules';
import { customGameBotRoomNode } from './custom-game-bots';
import { GAME_SESSION_HARNESS_ACTIONS } from './game-session-actions';
import type { HarnessGame } from './harness-game';
import { assertHarnessGame } from './harness-game';
import { registerHarnessGames } from './harness-game-of';
import { seedKnownPuzzles } from './known-puzzle-catalogue';

export type GameSystemOptions = {
  /** Replaces a game's own slice (a richer seed for its own suites). */
  readonly slices?: readonly HarnessSlice[];
  /**
   * The puzzle catalogue holds each game's known puzzles and nothing else,
   * in place of the content a game's own slice seeds: a world whose every
   * puzzle a scenario knows in advance.
   */
  readonly knownPuzzles?: boolean;
  /** Further subs a suite plays the games beside (the synthetic population). */
  readonly beside?: readonly HarnessSlice[];
  readonly product?: Parameters<typeof defineProductSystem>[1];
};

/**
 * The world every game suite runs in: the spaces a game is played in, the
 * people and friends around it, the shared custom-game, opponent and history
 * sessions, and exactly the `games` given, registered as production
 * registers them. No game is named here; a game's own sub arrives with it.
 */
export function gameSystem(
  name: string,
  games: readonly HarnessGame[],
  options: GameSystemOptions = {}
) {
  for (const game of games) assertHarnessGame(game);
  const turnGames = createTurnGames(games.map((game) => game.shared.turnGame));
  const spaces = spacesHarnessSlice({
    games: games.map((game) => game.shared),
    clients: games.map((game) => game.client),
    blocks: FRIENDS_BLOCK_RELATION,
  });
  if (spaces.roomNode === undefined)
    throw new Error('Games need the spaces room node');
  const replaced = new Map(
    (options.slices ?? []).map((slice) => [slice.name, slice])
  );
  const composition = composeHarnessSlices(name, [
    ACCOUNT_PRIVACY_HARNESS_SLICE,
    PROFILE_HARNESS_SLICE,
    { ...spaces, roomNode: customGameBotRoomNode(spaces.roomNode) },
    FRIENDS_HARNESS_SLICE,
    NOTIFICATIONS_HARNESS_SLICE,
    SEARCH_HARNESS_SLICE,
    ...games.flatMap((game) => {
      if (game.slice === undefined) return [];
      const slice = replaced.get(game.slice.name) ?? game.slice;
      if (options.knownPuzzles !== true) return [slice];
      const { seedServer: _ownContent, ...withoutContent } = slice;
      return [withoutContent];
    }),
    {
      name: 'game-session',
      sub: createGameSessionSub(turnGames.games),
      client: createMultiplayerLinkClient(turnGames),
      server: (deps) => createGameSessionServer(deps.rooms, turnGames),
      actions: [
        ...GAME_SESSION_HARNESS_ACTIONS,
        ...OPPONENT_SEEKING_ACTIONS,
        ...MATCHED_GAME_HARNESS_ACTIONS,
        ...games.flatMap((game) => game.actions ?? []),
      ],
    },
    ...gamePuzzleSubs(turnGames).map(
      (sub): HarnessSlice => ({
        name: 'game-puzzle',
        sub,
        client: {
          ...createPuzzleLinkClient(turnGames),
          subs: createPersonalPuzzleStatsClients(
            games.map((game) => game.client)
          ),
        },
        server: () => GAME_PUZZLE_SERVER,
        ...(options.knownPuzzles === true
          ? {
              seedServer: (sqlClient) =>
                seedKnownPuzzles(sqlClient, turnGames, games),
            }
          : {}),
      })
    ),
    BILLING_HARNESS_SLICE,
    ...(options.beside ?? []),
  ]);
  registerHarnessGames(composition, games);
  return defineProductSystem(composition, options.product);
}

/** Open a world of `system`, ending any search a scenario left waiting. */
export async function openGameHarness(
  system: ReturnType<typeof gameSystem>,
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return withOpponentSearchCleanup(await openHarness(system, testId, options));
}
