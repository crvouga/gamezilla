/**
 * The shared custom-game set-up world on top of `game-world`: the people in
 * the host's space, the choices they make and the custom game they see.
 */

import { expect } from 'bun:test';
import { operateCustomGame } from '@libs/game-session-harness/custom-game-controls';
import { readCustomGameIdentity } from '@libs/game-session-harness/custom-game-identity';
import type { CustomGameLineup } from '@libs/game-session-harness/custom-game-lineup';
import { joinCustomGames } from '@libs/game-session-harness/custom-game-lineup';
import { readCustomGameProbe } from '@libs/game-session-harness/custom-game-probe';
import { raceCustomGameChoices } from '@libs/game-session-harness/custom-game-race';
import { configureCustomGameChoice } from '@libs/game-session-harness/custom-game-ui';
import type {
  CustomGameChoice,
  CustomGameInput,
} from '@libs/game-session-shared/custom-game-choice';
import type {
  CustomGame,
  CustomGameSide,
} from '@libs/game-session-shared/custom-game-state';
import type { ProductHarness } from '@libs/harness/harness';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { backToCustomGames, gameOf, hostOf, view } from './game-world';

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
  input: CustomGameInput
): Promise<void> {
  await w.s.apply(operateCustomGame, actor, input);
}

/** A choice a scenario relies on: a refusal fails the precondition. */
export async function chosen(
  w: HarnessWorld,
  actor: string,
  input: CustomGameInput
): Promise<void> {
  await w.s.apply(configureCustomGameChoice, actor, input);
}

/** `person` is in the host's space, shown the game's custom games. */
export async function inSpace(w: HarnessWorld, person: string): Promise<void> {
  await w.s.apply(joinCustomGames, gameOf(w).shared.id, hostOf(w), person);
}

/** Who `person` is to the custom game, in or out of the space. */
export async function identityOf(
  w: HarnessWorld,
  person: string
): Promise<string> {
  const seen = await w.s.read(readCustomGameProbe, person);
  return seen?.myId || (await w.s.read(readCustomGameIdentity, person));
}

/** The custom game as its host sees it now, back at the custom games. */
export async function current(w: HarnessWorld): Promise<CustomGame> {
  await backToCustomGames(w, hostOf(w));
  const game = (await view(w, hostOf(w))).current;
  if (game === null) throw new Error('The host sees no custom game');
  return game;
}

/** The side taken by `person`, as the custom game records it. */
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
): Promise<readonly CustomGameSide[]> {
  const game = await current(w);
  const id = await identityOf(w, actor);
  return game.ready.filter((side) => game[side].person === id);
}

/**
 * Send every choice for the custom game as it is now at the same instant,
 * each from its person's device, before any answer comes back.
 */
export async function race(
  w: HarnessWorld,
  attempts: readonly {
    readonly actor: string;
    readonly choice: CustomGameInput;
  }[]
): Promise<void> {
  const game = await current(w);
  const link = await w.s.read(readSpaceLink, hostOf(w));
  const spaceId = link?.split('/space/')[1];
  if (spaceId === undefined) throw new Error('The host is not in a space');
  await w.s.apply(raceCustomGameChoices, {
    spaceId,
    choices: attempts.map(({ actor, choice }) => ({
      actor,
      choice: {
        ...choice,
        gameId: game.id,
        revision: game.revision,
      } as CustomGameChoice,
    })),
  });
}

/** `actor` is told one of `reasons`, the refusal their custom game shows. */
export async function toldOf(
  w: HarnessWorld,
  actor: string,
  ...reasons: readonly string[]
): Promise<void> {
  expect(reasons).toContain((await view(w, actor)).error);
}

/** A custom game `host` is setting up, Bob in the space unless he plays. */
export function settingUp(
  host: string,
  second: string | 'open' = 'open'
): CustomGameLineup {
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
): Promise<CustomGameSide | null> {
  if (!s.actors.has(person)) return null;
  return (await readCustomGameProbe(s, person))?.mySide ?? null;
}
