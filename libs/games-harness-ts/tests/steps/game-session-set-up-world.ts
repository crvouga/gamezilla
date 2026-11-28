/**
 * The shared game-session set-up world on top of `game-world`: the people in
 * the host's space, the choices they make and the game session they see.
 */

import { expect } from 'bun:test';
import { operateGameSession } from '@libs/game-session-harness-ts/game-session-controls';
import { readGameSessionIdentity } from '@libs/game-session-harness-ts/game-session-identity';
import type { GameSessionLineup } from '@libs/game-session-harness-ts/game-session-lineup';
import { joinGameSessions } from '@libs/game-session-harness-ts/game-session-lineup';
import { readGameSessionProbe } from '@libs/game-session-harness-ts/game-session-probe';
import { raceGameSessionChoices } from '@libs/game-session-harness-ts/game-session-race';
import { configureGameSessionChoice } from '@libs/game-session-harness-ts/game-session-ui';
import type {
  GameSessionChoice,
  GameSessionInput,
} from '@libs/game-session-shared-ts/game-session-choice';
import type {
  GameSession,
  GameSessionSide,
} from '@libs/game-session-shared-ts/game-session-state';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { backToGameSessions, gameOf, hostOf, view } from './game-world';

/** `5+2` as the minutes each side starts with and the seconds a move adds. */
export function clockChoice(text: string): {
  minutes: number;
  increment: number;
} {
  const [minutes, increment] = text.split('+').map(Number);
  if (minutes === undefined || increment === undefined)
    throw new Error(`a clock choice reads like 5+2, not "${text}"`);
  return { minutes, increment };
}

/** A choice `actor` makes, with the screen's own controls where it has them. */
export async function choose(
  w: HarnessWorld,
  actor: string,
  input: GameSessionInput
): Promise<void> {
  await w.s.apply(operateGameSession, actor, input);
}

/** A choice a scenario relies on: a refusal fails the precondition. */
export async function chosen(
  w: HarnessWorld,
  actor: string,
  input: GameSessionInput
): Promise<void> {
  await w.s.apply(configureGameSessionChoice, actor, input);
}

/** `person` is in the host's space, shown the game's game sessions. */
export async function inSpace(w: HarnessWorld, person: string): Promise<void> {
  await w.s.apply(joinGameSessions, gameOf(w).shared.id, hostOf(w), person);
}

/** Who `person` is to the game session, in or out of the space. */
export async function identityOf(
  w: HarnessWorld,
  person: string
): Promise<string> {
  const seen = await w.s.read(readGameSessionProbe, person);
  return seen?.myId || (await w.s.read(readGameSessionIdentity, person));
}

/** The game session as its host sees it now, back at the game sessions. */
export async function current(w: HarnessWorld): Promise<GameSession> {
  await backToGameSessions(w, hostOf(w));
  const game = (await view(w, hostOf(w))).current;
  if (game === null) throw new Error('The host sees no game session');
  return game;
}

/** The side taken by `person`, as the game session records it. */
export async function seatOf(
  w: HarnessWorld,
  person: string
): Promise<{ readonly kind: 'person'; readonly person: string }> {
  return { kind: 'person', person: await identityOf(w, person) };
}

/** The sides `actor` is ready on. */
export async function readySidesOf(
  w: HarnessWorld,
  actor: string
): Promise<readonly GameSessionSide[]> {
  const game = await current(w);
  const id = await identityOf(w, actor);
  return game.ready.filter((side) => game[side].person === id);
}

/**
 * Send every choice for the game session as it is now at the same instant,
 * each from its person's device, before any answer comes back.
 */
export async function race(
  w: HarnessWorld,
  attempts: readonly {
    readonly actor: string;
    readonly choice: GameSessionInput;
  }[]
): Promise<void> {
  const game = await current(w);
  const link = await w.s.read(readSpaceLink, hostOf(w));
  const spaceId = link?.split('/space/')[1];
  if (spaceId === undefined) throw new Error('The host is not in a space');
  await w.s.apply(raceGameSessionChoices, {
    spaceId,
    choices: attempts.map(({ actor, choice }) => ({
      actor,
      choice: {
        ...choice,
        gameId: game.id,
        revision: game.revision,
      } as GameSessionChoice,
    })),
  });
}

/** `actor` is told one of `reasons`, the refusal their game session shows. */
export async function toldOf(
  w: HarnessWorld,
  actor: string,
  ...reasons: readonly string[]
): Promise<void> {
  expect(reasons).toContain((await view(w, actor)).error);
}

/** A game session `host` is setting up, Bob in the space unless he plays. */
export function settingUp(
  host: string,
  second: string | 'open' = 'open'
): GameSessionLineup {
  return {
    host,
    first: host,
    second,
    watchers: second === 'open' ? ['bob'] : [],
    ready: false,
    active: false,
  };
}

/** The side `person`'s own device says they hold, if they are on stage. */
export async function sideShownTo(
  s: ProductHarness,
  person: string
): Promise<GameSessionSide | null> {
  if (!s.actors.has(person)) return null;
  return (await readGameSessionProbe(s, person))?.mySide ?? null;
}
