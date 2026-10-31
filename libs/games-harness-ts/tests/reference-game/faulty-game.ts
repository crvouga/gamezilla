/**
 * Deliberately faulty copies of the reference game, each defined through
 * the same public constructors as any game (`defineGame`,
 * `defineGameClient`), and the shared laws' verdict on them: which laws
 * refuse a game, and why.
 */

import type { GameClient } from '@libs/game-menu-client-ts/game-client';
import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import {
  gameFrameLaws,
  gamePresentationLaws,
  gameRecordLaws,
} from '@libs/game-session-harness-ts/game-capability-laws';
import { gamePuzzleLaws } from '@libs/game-session-harness-ts/game-puzzle-laws';
import type { GameLaw } from '@libs/game-session-harness-ts/game-rules-laws';
import {
  gameBotLaws,
  gameRulesLaws,
} from '@libs/game-session-harness-ts/game-rules-laws';
import type { TurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import type {
  TurnGame,
  TurnGameDefinition,
} from '@libs/game-session-shared-ts/game-definition';
import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import { SETUP_RACE_GAME } from '../probes/setup-race-game';
import { SOLO_COUNT_GAME } from '../probes/solo-count-game';
import {
  COUNTING_RACE_CLIENT,
  COUNTING_RACE_FIXTURES,
  COUNTING_RACE_GAME,
  COUNTING_RACE_TURN_GAME,
} from './counting-race-game';

/** The reference game with parts of its definition, client or adapter replaced. */
export function definedWith(
  turnGame: Partial<TurnGame>,
  client: Partial<GameClient<TurnGameDefinition>> = {},
  adapter: Partial<Pick<TurnHarnessGame, 'readRecord' | 'fixtures'>> = {}
): TurnHarnessGame {
  const shared = defineGame({ ...COUNTING_RACE_TURN_GAME, ...turnGame });
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

/**
 * Foreign inputs belong to test-owned consumers, even when production has
 * no games. These independently authored inputs share no concrete plugin
 * fixture, position namespace or rules implementation.
 */
const FOREIGN_INPUTS = [SETUP_RACE_GAME, SOLO_COUNT_GAME];

/** Every shared law a game is held to, against independent foreign inputs. */
function lawsOf(game: TurnHarnessGame): readonly GameLaw[] {
  const others = FOREIGN_INPUTS.filter(
    (other) => other.shared.id !== game.shared.id
  );
  return [
    ...gameRulesLaws(game, others),
    ...gameBotLaws(game),
    ...gamePresentationLaws(game),
    ...gameFrameLaws(game),
    ...gameRecordLaws(game),
    ...gamePuzzleLaws(game, others),
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
export function refusals(game: TurnHarnessGame): ReadonlyMap<string, string> {
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
export function lawNames(game: TurnHarnessGame): readonly string[] {
  return lawsOf(game).map((law) => law.name);
}
