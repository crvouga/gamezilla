/**
 * A person's private setup in the run's game, whichever game it is, in a
 * custom game or a matched game: the side's known setup (`fixtures.setups`),
 * the one a scenario changed it to, and the people paired in a matched game
 * that still waits for both setups.
 */

import { expect } from 'bun:test';
import {
  inMatchedGame,
  ownerOf,
  pairOf,
  sameBoards,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import {
  awaitGameMatchChoosingSetups,
  givenOpponentSearch,
} from '@libs/game-matchmaking-harness-ts/multiplayer-fixtures';
import { multiplayerView } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import {
  arrangeCustomGamePrivateSetup,
  customGamePrivateSetupShown,
} from '@libs/game-session-harness-ts/custom-game-private-setup';
import { readCustomGameScreen } from '@libs/game-session-harness-ts/custom-game-screen';
import {
  arrangeMatchedPrivateSetup,
  chooseMatchedPrivateSetup,
  matchedPrivateSetupStatus,
  ownMatchedPrivateSetup,
} from '@libs/game-session-harness-ts/matched-game-private-setup';
import { playedRulesOf } from '@libs/game-session-harness-ts/played-rules';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import type { GameSetups } from '@pkgs/turn-game-shared-ts/game-rules';
import { identityOf } from './custom-game-set-up-world';
import { before, gameOf, sideOf } from './game-world';
import { readyPeople, timeControlFor } from './matched-game';

/** What a person is told of a private setup that is not complete. */
export const INCOMPLETE = 'Your private setup is incomplete.';

/** The run's game's known setups, one for each side. */
export function knownSetups(w: HarnessWorld): GameSetups {
  const setups = gameOf(w).fixtures.setups;
  if (setups === undefined)
    throw new Error(`${gameOf(w).label} names no private setups`);
  return setups;
}

/** The side `actor` plays. */
export async function sideOfPerson(
  w: HarnessWorld,
  actor: string
): Promise<'white' | 'black'> {
  if (!inMatchedGame(w)) {
    if ((await w.s.read(readCustomGameScreen, actor)) !== null)
      return sideOf(w, actor);
    // Away from the custom game (in its history): the side it was set up with.
    const id = await identityOf(w, actor);
    const game = before(w).current;
    if (game?.white.person === id) return 'white';
    if (game?.black.person === id) return 'black';
    throw new Error(`${actor} plays no side`);
  }
  const index = pairOf(w).indexOf(actor);
  if (index < 0) throw new Error(`${actor} plays no side`);
  return index === 0 ? 'white' : 'black';
}

/** The known setup of `actor`'s side. */
export async function knownSetupOf(
  w: HarnessWorld,
  actor: string
): Promise<string> {
  return knownSetups(w)[await sideOfPerson(w, actor)];
}

const heldKey = (actor: string) => `private-setup:held:${actor}`;

/** `actor`'s private setup: the one the scenario changed it to, else their side's known one. */
export async function setupOf(w: HarnessWorld, actor: string): Promise<string> {
  const held = w.memo.get(heldKey(actor));
  return typeof held === 'string' ? held : knownSetupOf(w, actor);
}

/**
 * The private setups of `actor` and of `other`, the two sides: `other`'s
 * side read where `other` looks, so `actor` may be elsewhere (in the game's
 * history).
 */
export async function opposingSetups(
  w: HarnessWorld,
  actor: string,
  other: string
): Promise<readonly [string, string]> {
  const otherSide = await sideOfPerson(w, other);
  const held = (person: string, side: 'white' | 'black') => {
    const setup = w.memo.get(heldKey(person));
    return typeof setup === 'string' ? setup : knownSetups(w)[side];
  };
  return [
    held(actor, otherSide === 'white' ? 'black' : 'white'),
    held(other, otherSide),
  ];
}

/** Remember that `actor` arranged `setup`. */
export function rememberSetup(w: HarnessWorld, actor: string, setup: string) {
  w.memo.set(heldKey(actor), setup);
}

/** `actor` arranges their side's known setup on their setup board. */
export async function arrangeKnownSetup(w: HarnessWorld, actor: string) {
  const setup = await knownSetupOf(w, actor);
  await w.s.apply(
    inMatchedGame(w)
      ? arrangeMatchedPrivateSetup
      : arrangeCustomGamePrivateSetup,
    actor,
    setup
  );
  rememberSetup(w, actor, setup);
}

/** What `actor` is told of their own private setup, if anything. */
export async function setupStatusOf(
  w: HarnessWorld,
  actor: string
): Promise<string | null> {
  return inMatchedGame(w)
    ? w.s.read(matchedPrivateSetupStatus, actor)
    : (await w.s.read(customGamePrivateSetupShown, actor)).status;
}

/** `actor` arranges nothing, so their private setup stays incomplete. */
export async function leaveSetupIncomplete(w: HarnessWorld, actor: string) {
  await w.s.apply(
    inMatchedGame(w)
      ? arrangeMatchedPrivateSetup
      : arrangeCustomGamePrivateSetup,
    actor,
    null
  );
  expect(await setupStatusOf(w, actor)).toBe(INCOMPLETE);
}

/** `actor`'s device shows them ready in their matched game. */
async function shownReady(w: HarnessWorld, actor: string) {
  const side = await sideOfPerson(w, actor);
  await w.s.until(async (s) => (await multiplayerView(s, actor)).game, {
    pred: (game) => game?.setup_ready?.split(',').includes(side) === true,
  });
}

/** `actor` has arranged their known setup and chosen it in their matched game. */
export async function chosenSetup(w: HarnessWorld, actor: string) {
  await arrangeKnownSetup(w, actor);
  await w.s.apply(chooseMatchedPrivateSetup, actor);
  await shownReady(w, actor);
  // Their device reads their own chosen setup back, as their screen shows it.
  await w.s.until((world) => ownMatchedPrivateSetup(world, actor), {
    pred: (own) => own !== null,
  });
}

/** A new matched game of the run's game, its private setups still to choose. */
export async function pairedChoosingSetups(
  w: HarnessWorld,
  first: string,
  second: string,
  clock: string
) {
  const timeControl = timeControlFor(w, clock);
  await readyPeople(w, [first, second]);
  await w.s.apply(givenOpponentSearch, first, timeControl);
  await w.s.advanceTime(1);
  await w.s.apply(givenOpponentSearch, second, timeControl);
  await w.s.apply(awaitGameMatchChoosingSetups, first, second, true);
  const game = await sameBoards(w, first, second);
  expect(game.white_id).toBe(await ownerOf(w, first));
  expect(game.setup_ready).toBe('');
  w.memo.set('multiplayer:game', game);
  w.memo.set('multiplayer:pair', [first, second]);
}

/** The public position after the first `ply` moves of the game's known victory. */
export function revealedAfter(w: HarnessWorld, ply: number): string {
  return playedRulesOf(gameOf(w)).replay(
    gameOf(w).fixtures.firstSideVictory,
    ply
  );
}
