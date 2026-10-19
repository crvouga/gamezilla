/**
 * Deliberately faulty copies of the reference game, each defined through
 * the same public constructors as any game (`defineTurnGame`,
 * `defineGameClient`), and the shared laws' verdict on them: which laws
 * refuse a game, and why.
 */

import type { GameClient } from '@libs/game-menu-client/game-client';
import { defineGameClient } from '@libs/game-menu-client/game-client';
import {
  gamePresentationLaws,
  gameRecordLaws,
} from '@libs/game-session-harness/game-capability-laws';
import { gamePuzzleLaws } from '@libs/game-session-harness/game-puzzle-laws';
import type { GameLaw } from '@libs/game-session-harness/game-rules-laws';
import {
  gameBotLaws,
  gameRulesLaws,
} from '@libs/game-session-harness/game-rules-laws';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import type { TurnGame } from '@libs/game-session-shared/turn-game-definition';
import { defineTurnGame } from '@libs/game-session-shared/turn-game-definition';
import { HARNESS_GAMES } from '@libs/games-harness/harness-games';
import {
  COUNTING_RACE_CLIENT,
  COUNTING_RACE_FIXTURES,
  COUNTING_RACE_GAME,
  COUNTING_RACE_TURN_GAME,
} from './counting-race-game';

/** The reference game with parts of its definition, client or adapter replaced. */
export function definedWith(
  turnGame: Partial<TurnGame>,
  client: Partial<GameClient> = {},
  adapter: Partial<Pick<HarnessGame, 'readRecord' | 'fixtures'>> = {}
): HarnessGame {
  const shared = defineTurnGame({ ...COUNTING_RACE_TURN_GAME, ...turnGame });
  // A copy offering no puzzles has no puzzles part and names no puzzle.
  const offersPuzzles = shared.turnGame.capabilities.puzzles !== undefined;
  const { puzzles, ...withoutPuzzles } = COUNTING_RACE_CLIENT;
  const { puzzles: known, ...rulesFixtures } = COUNTING_RACE_FIXTURES;
  return {
    label: COUNTING_RACE_GAME.label,
    shared,
    client: defineGameClient({
      ...withoutPuzzles,
      ...(offersPuzzles ? { puzzles } : {}),
      shared,
      ...client,
    }),
    ...(adapter.readRecord === undefined
      ? {}
      : { readRecord: adapter.readRecord }),
    fixtures: {
      ...(offersPuzzles ? { ...rulesFixtures, puzzles: known } : rulesFixtures),
      ...adapter.fixtures,
    },
  };
}

/** Every shared law a game is held to, among the registered games. */
function lawsOf(game: HarnessGame): readonly GameLaw[] {
  return [
    ...gameRulesLaws(game, HARNESS_GAMES),
    ...gameBotLaws(game),
    ...gamePresentationLaws(game),
    ...gameRecordLaws(game),
    ...gamePuzzleLaws(game, HARNESS_GAMES),
  ];
}

/** An error's message and every cause's, so a refusal's reason is readable. */
function reasonOf(error: unknown): string {
  const parts: string[] = [];
  for (let at: unknown = error; at instanceof Error; at = at.cause)
    parts.push(at.message);
  return parts.join('\n');
}

/** Each law `game` breaks, with why: law name → the refusal's reason. */
export function refusals(game: HarnessGame): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const law of lawsOf(game))
    try {
      law.check();
    } catch (error) {
      out.set(law.name, reasonOf(error));
    }
  return out;
}

/** The names of the laws `game` is held to (each runs once per game). */
export function lawNames(game: HarnessGame): readonly string[] {
  return lawsOf(game).map((law) => law.name);
}
