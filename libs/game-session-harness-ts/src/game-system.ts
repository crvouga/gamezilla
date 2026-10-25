import { ACCOUNT_PRIVACY_HARNESS_SLICE } from '@libs/account-privacy-harness-ts/account-privacy-harness-slice';
import { BILLING_HARNESS_SLICE } from '@libs/billing-harness-ts/billing-harness-slice';
import { FRIENDS_HARNESS_SLICE } from '@libs/friends-harness-ts/friends-harness-slice';
import { FRIENDS_BLOCK_RELATION } from '@libs/friends-shared-ts/block-relation';
import { createMultiplayerLinkClient } from '@libs/game-matchmaking-client-ts/multiplayer-link-client';
import { MATCHED_GAME_HARNESS_ACTIONS } from '@libs/game-matchmaking-harness-ts/matched-game-actions';
import {
  registerKnownDeals,
  registerKnownSetups,
} from '@libs/game-matchmaking-harness-ts/multiplayer-setups';
import { withOpponentSearchCleanup } from '@libs/game-matchmaking-harness-ts/opponent-search-cleanup';
import { OPPONENT_SEEKING_ACTIONS } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { createPersonalPuzzleStatsClients } from '@libs/game-menu-client-ts/personal-puzzle-stats-clients';
import { createPuzzleLinkClient } from '@libs/game-puzzle-client-ts/puzzle-link-client';
import { GAME_PUZZLE_SERVER } from '@libs/game-puzzle-shared-ts/puzzle-sub-server';
import { seedStarterContent } from '@libs/game-puzzle-shared-ts/starter-content';
import { gamePuzzleSubs } from '@libs/game-puzzle-shared-ts/sub';
import { createGameSessionServer } from '@libs/game-session-server-ts/sub-server';
import { createGameSessionSub } from '@libs/game-session-shared-ts/sub';
import { defineProductSystem } from '@libs/harness-ts/define-product-system';
import type { OpenHarnessOptions } from '@libs/harness-ts/mode';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import { openHarness } from '@libs/harness-ts/open-harness';
import type { HarnessSlice } from '@libs/harness-ts/slices';
import { composeHarnessSlices } from '@libs/harness-ts/slices';
import { NOTIFICATIONS_HARNESS_SLICE } from '@libs/notifications-harness-ts/notifications-harness-slice';
import { PROFILE_HARNESS_SLICE } from '@libs/profile-harness-ts/profile-harness-slice';
import { SEARCH_HARNESS_SLICE } from '@libs/search-harness-ts/search-harness-slice';
import { spacesHarnessSlice } from '@libs/spaces-harness-ts/spaces-harness-slice';
import {
  createTurnGames,
  prepareTurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { customGameBotRoomNode } from './custom-game-bots';
import { GAME_SESSION_HARNESS_ACTIONS } from './game-session-actions';
import type { HarnessGame } from './harness-game';
import { assertHarnessGame } from './harness-game';
import { registerHarnessGames } from './harness-game-of';
import { seedKnownPuzzles } from './known-puzzle-catalogue';

/** When a world's starter content was published: before any scenario begins. */
const STARTER_SEEDED_AT = Date.UTC(2026, 0, 1);

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
        ...new Set([
          ...GAME_SESSION_HARNESS_ACTIONS,
          ...OPPONENT_SEEKING_ACTIONS,
          ...MATCHED_GAME_HARNESS_ACTIONS,
          ...games.flatMap((game) => game.actions ?? []),
        ]),
      ],
    },
    ...gamePuzzleSubs(games.map((game) => game.shared)).map(
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
        seedServer: async (sqlClient) => {
          if (options.knownPuzzles === true)
            await seedKnownPuzzles(sqlClient, turnGames, games);
          // Every game's starter puzzles, as a deploy publishes them.
          await prepareTurnGames(turnGames);
          await sqlClient.transaction((tx) =>
            seedStarterContent(
              tx,
              games.map((game) => game.shared),
              STARTER_SEEDED_AT
            )
          );
        },
      })
    ),
    BILLING_HARNESS_SLICE,
    ...(options.beside ?? []),
  ]);
  registerHarnessGames(composition, games);
  registerKnownSetups(
    composition,
    (position, side) =>
      games.find((game) => game.shared.turnGame.rules.recognizes(position))
        ?.fixtures.setups?.[side]
  );
  registerKnownDeals(
    composition,
    (position) =>
      games.find((game) => game.shared.turnGame.rules.recognizes(position))
        ?.fixtures.knownDeal?.hidden
  );
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
