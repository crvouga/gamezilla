/**
 * The run's game in a matched game: the shared matched-game world
 * (`@libs/game-matchmaking-harness/matched-game-world`) given the game's
 * people, its clock namespace and the moves from its fixtures.
 */

import {
  abortedByFirst,
  acceptedMoves,
  drawnByAgreement,
  pairMatchedGame,
  pairOf,
  refusal,
  resignedBySecond,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { givenGameSpace } from '@libs/game-matchmaking-harness/opponent-seeking';
import {
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import { signedInAccountOf } from '@libs/harness/identity';
import { backToTabs } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { gameOf } from './game-world';

/** The clock choice a new matched game is played at unless one is named. */
const NEW_GAME_CLOCK = '5+0';

/** `clock` (`5+0`) as the run's game names it among its time controls. */
export function timeControlFor(w: HarnessWorld, clock = NEW_GAME_CLOCK) {
  const matchmaking = gameOf(w).shared.turnGame.capabilities.matchmaking;
  if (matchmaking === undefined)
    throw new Error(`${gameOf(w).label} offers no finding an opponent`);
  return `${matchmaking.clockNamespace}${clock}`;
}

/** Each person signed in, with a space of their own to play in. */
export async function readyPeople(w: HarnessWorld, people: readonly string[]) {
  for (const person of people) {
    if ((await w.s.read(signedInAccountOf, person)) === null)
      await w.s.apply(signInWithGoogle, person);
    await w.s.apply(backToTabs, person);
    await w.s.apply(givenGameSpace, person);
  }
}

/** A new matched game of the run's game, `first` on the first side. */
export function pairedAt(
  w: HarnessWorld,
  first: string,
  second: string,
  clock = NEW_GAME_CLOCK
) {
  return pairMatchedGame(w, {
    people: readyPeople,
    first,
    second,
    timeControl: timeControlFor(w, clock),
  });
}

/** The game's fixture moves, from the first side, that win it. */
function victory(w: HarnessWorld): readonly string[] {
  return gameOf(w).fixtures.firstSideVictory;
}

/** The first move of `actor`'s side: the first side's, then the second's. */
export function firstMoveOf(w: HarnessWorld, actor: string): string {
  return victory(w)[pairOf(w).indexOf(actor)]!;
}

/** The move of the game's victory due after `revision` moves. */
export function victoryMoveAt(w: HarnessWorld, revision: number): string {
  const due = victory(w)[revision];
  if (due === undefined)
    throw new Error(`No victory move after ${String(revision)}`);
  return due;
}

/**
 * The move of the game's victory due after `revision` moves; once the whole
 * victory is played, its winning move again, which a finished game refuses.
 */
export function nextVictoryMove(w: HarnessWorld, revision: number): string {
  const line = victory(w);
  return line[Math.min(revision, line.length - 1)]!;
}

/** A move the game refuses. */
export function refusedMove(w: HarnessWorld): string {
  return gameOf(w).fixtures.refusedOpenings[0]!;
}

/** Both people have made their first move. */
export function firstMoves(w: HarnessWorld) {
  return acceptedMoves(w, victory(w).slice(0, 2));
}

/** A matched game both people began, then the second side resigned. */
export async function finishedAt(
  w: HarnessWorld,
  first: string,
  second: string,
  clock: string
) {
  await pairedAt(w, first, second, clock);
  await firstMoves(w);
  await resignedBySecond(w);
}

export async function abortedAt(
  w: HarnessWorld,
  first: string,
  second: string,
  clock: string
) {
  await pairedAt(w, first, second, clock);
  await abortedByFirst(w);
}

export async function drawnAfterFirstMoves(
  w: HarnessWorld,
  first: string,
  second: string,
  clock: string
) {
  await pairedAt(w, first, second, clock);
  await firstMoves(w);
  await drawnByAgreement(w);
}

/** `person`'s other device, signed in to their account. */
export async function otherDevice(w: HarnessWorld, person: string) {
  const device = `${person}_computer`;
  const account = await w.s.read(signedInAccountOf, person);
  const present = await w.s.read((s) => s.actors.has(device));
  // A device still signed in keeps the account after the phone signed out.
  const onDevice = present ? await w.s.read(signedInAccountOf, device) : null;
  if (onDevice === null || (account !== null && onDevice !== account))
    await w.s.apply(signInWithGoogleAsAccount, device, person);
  w.memo.set(`multiplayer:other:${person}`, device);
  return device;
}

/** `person` acts on `device` from now on in the scenario. */
export function actOnOtherDevice(
  w: HarnessWorld,
  person: string,
  device: string
) {
  w.memo.set(`matched-game:acting:${person}`, device);
}

/** The device `person` last acted on, where what they are told shows. */
export function actingDevice(w: HarnessWorld, person: string): string {
  return String(w.memo.get(`matched-game:acting:${person}`) ?? person);
}

/** The device `person` opened finding an opponent on last. */
export function seenOn(w: HarnessWorld, person: string): string {
  return String(w.memo.get(`multiplayer:other:${person}`) ?? person);
}

/** `person` was refused with `code` where they acted. */
export function told(w: HarnessWorld, person: string, code: string) {
  return refusal(w, actingDevice(w, person), code);
}
