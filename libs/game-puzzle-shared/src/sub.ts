import type { SubManifest } from '@libs/sub-shared/manifest';
import { defineSub } from '@libs/sub-shared/manifest';
import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
import { appendPuzzleInteractionMutation } from './append-puzzle-interaction-mutation';
import { chessPuzzleById } from './by-id-query';
import { chessPuzzleFeedSettings } from './feed-settings-query';
import { chessPuzzleInteractions } from './interactions-query';
import { chessPuzzleNearest, chessPuzzlePool } from './pool-query';
import { chessPuzzleProfile } from './profile-query';
import { PUZZLE_PRIVACY } from './puzzle-account-privacy';
import { PUZZLE_TABLES } from './puzzle-tables';
import { PUZZLE_TOPIC_MAP } from './puzzle-topic-map';
import { ratePuzzleAttemptMutation } from './rate-puzzle-attempt-mutation';
import { chessPuzzleRatingEvents } from './rating-events-query';
import { savePuzzleFeedSettingsMutation } from './save-puzzle-feed-settings-mutation';

/** The puzzle catalogue and every person's puzzle progress, read by any game. */
export const PUZZLE_QUERIES = [
  chessPuzzleProfile,
  chessPuzzleFeedSettings,
  chessPuzzleInteractions,
  chessPuzzleRatingEvents,
  chessPuzzlePool,
  chessPuzzleNearest,
  chessPuzzleById,
] as const;

/** A person's puzzle attempts, ratings and feed choices, for any game. */
export const PUZZLE_MUTATIONS = [
  appendPuzzleInteractionMutation,
  ratePuzzleAttemptMutation,
  savePuzzleFeedSettingsMutation,
] as const;

/**
 * The platform's puzzles: the catalogue every offering game's puzzles share,
 * people's ratings, attempts and feed settings, and their erasure. No game
 * is named here; a game's own import pipeline stays in its own sub.
 * Table, query and mutation names keep their established identities.
 */
export const GAME_PUZZLE_SUB = defineSub({
  name: 'game-puzzle',
  accountPrivacy: PUZZLE_PRIVACY,
  tables: PUZZLE_TABLES,
  readsForeign: [],
  topicMap: PUZZLE_TOPIC_MAP,
  // Held open for the whole session: what keeps a person's puzzle
  // progress warm in the local database.
  sessionQueries: [
    'chessPuzzleProfile',
    'chessPuzzleFeedSettings',
    'chessPuzzleInteractions',
    'chessPuzzleRatingEvents',
  ],
  queries: PUZZLE_QUERIES,
  mutations: async () => PUZZLE_MUTATIONS,
});

/**
 * The puzzle sub exactly when a registered game offers puzzles: a product
 * whose games offer none has no puzzle tables, reads or writes.
 */
export function gamePuzzleSubs(turnGames: TurnGames): readonly SubManifest[] {
  return turnGames.games.some((game) => game.capabilities.puzzles !== undefined)
    ? [GAME_PUZZLE_SUB]
    : [];
}
