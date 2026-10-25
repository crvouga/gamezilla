/**
 * Secret choices in a four-player custom game: Alice, Bob, Carol and Dave
 * sit first to fourth, a round of secret choices is found on the game's
 * known line, and each person's own secret choice is the one the known line
 * makes for their side (another is one the game's rules also take from their
 * hand).
 */

import { expect } from 'bun:test';
import type { CustomGameProbe } from '@libs/game-session-harness-ts/custom-game-probe';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import {
  makeCustomGameSecretChoice,
  ownCustomGameSecretChoiceShown,
  secretChoiceOnScreen,
} from '@libs/game-session-harness-ts/custom-game-secret-choice';
import { privateSetupsReaching } from '@libs/game-session-harness-ts/private-setup-reach';
import { restoreActorConnection } from '@libs/harness-ts/actions';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import { current } from './custom-game-set-up-world';
import { rememberCustomGame, turnGameOf, view } from './game-world';
import {
  followKnownLine,
  knownLine,
  secretChoiceRounds,
  secretChoicesOf,
} from './known-line';

/** The four people of a four-player custom game, first side to fourth. */
export const FOUR_PEOPLE = { third: 'carol', fourth: 'dave' } as const;

const SECOND_MS = 1_000;
/** How long a change may take to reach a connected person's screen. */
export const SHOWN_WITHIN_MS = 10 * SECOND_MS;

/** The side `actor` plays, as their own screen shows it. */
export async function sideShown(
  w: HarnessWorld,
  actor: string
): Promise<GameSide> {
  const side = (await view(w, actor)).mySide;
  if (side === null) throw new Error(`${actor} plays no side`);
  return side;
}

/**
 * Alice, Bob, Carol and Dave in a custom game that followed the known line
 * to the round of secret choices opening after `ply` moves, every side
 * still to choose.
 */
export async function awaitingSecretChoicesAt(
  w: HarnessWorld,
  ply: number
): Promise<void> {
  await followKnownLine(w, FOUR_PEOPLE, knownLine(w), ply);
  const game = await current(w);
  expect(game.awaiting).toEqual(game.sides);
  w.memo.set('secret-choices-round', ply);
}

/** The round of secret choices the scenario is in, by the moves before it. */
export function roundPly(w: HarnessWorld): number {
  const ply = w.memo.get('secret-choices-round');
  if (typeof ply !== 'number') throw new Error('No round of secret choices');
  return ply;
}

/**
 * A secret choice `actor` may make for their side in the round opening
 * after `ply` moves: the known line's (`which` 0), or another the game's
 * rules also take (`which` 1).
 */
export async function secretChoiceOf(
  w: HarnessWorld,
  actor: string,
  ply: number,
  which: 0 | 1 = 0
): Promise<string> {
  const side = await sideShown(w, actor);
  const choices = secretChoicesOf(turnGameOf(w), knownLine(w), ply, side);
  const choice = choices[which];
  if (choice === undefined)
    throw new Error(
      `${turnGameOf(w).label}: the ${side} side has no other secret choice`
    );
  return choice;
}

/** `actor` makes `commitment` their secret choice for the round opening after `ply` moves. */
export async function makeSecretChoice(
  w: HarnessWorld,
  actor: string,
  commitment: string,
  ply: number
): Promise<void> {
  await w.s.apply(makeCustomGameSecretChoice, actor, {
    gameId: turnGameOf(w).shared.id,
    commitment,
    ply,
  });
}

/**
 * `actor` makes the known line's secret choice for their side in the latest
 * round of secret choices, now (after as many moves as their screen shows),
 * remembered as theirs.
 */
export async function makeOwnSecretChoice(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  const ply = (await view(w, actor)).current?.moves.length ?? 0;
  const round = secretChoiceRounds(knownLine(w))
    .filter((opened) => opened <= ply)
    .at(-1);
  if (round === undefined)
    throw new Error(
      `${turnGameOf(w).label}: no round of secret choices before move ${String(ply)}`
    );
  // Someone with no side (a watcher) tries the first side's.
  const side =
    (await view(w, actor)).mySide ??
    gameSides(turnGameOf(w).shared.turnGame.rules)[0]!;
  const [commitment = ''] = secretChoicesOf(
    turnGameOf(w),
    knownLine(w),
    round,
    side
  );
  w.memo.set(`secret-choice:${actor}`, commitment);
  await makeSecretChoice(w, actor, commitment, ply);
}

/** `actor`'s secret choice as the scenario made or last saw it. */
export function rememberedSecretChoice(
  w: HarnessWorld,
  actor: string
): string | null {
  const remembered = w.memo.get(`secret-choice:${actor}`);
  return typeof remembered === 'string' ? remembered : null;
}

/** Remember `actor`'s own screen as it is now, before the act. */
export async function rememberScreen(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  w.memo.set(`screen-before:${actor}`, await w.s.read(customGameView, actor));
}

/** `actor`'s own screen as remembered before the act. */
export function screenBefore(w: HarnessWorld, actor: string): CustomGameProbe {
  const remembered = w.memo.get(`screen-before:${actor}`);
  if (remembered === undefined)
    throw new Error(`${actor}'s screen was not remembered`);
  return remembered as CustomGameProbe;
}

/** `viewer`'s screen shows `person`'s side among the sides that have chosen. */
export async function seesChosen(
  w: HarnessWorld,
  viewer: string,
  person: string
): Promise<void> {
  const side = await sideShown(w, person);
  const seen = await w.s.until((s) => customGameView(s, viewer), {
    pred: (shown) => shown.current?.committed.includes(side) === true,
    maxMs: SHOWN_WITHIN_MS,
  });
  expect(seen.current?.committed).toContain(side);
}

/**
 * `actor`'s own screen shows a secret choice of theirs: the one the scenario
 * made for them, if it made one (a stand-in's otherwise).
 */
export async function seesOwnSecretChoice(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  const made = rememberedSecretChoice(w, actor);
  const shown = await w.s.until(
    (s) => ownCustomGameSecretChoiceShown(s, actor),
    {
      pred: (own) => (made === null ? own !== null : own === made),
      maxMs: SHOWN_WITHIN_MS,
    }
  );
  if (made === null) expect(shown).not.toBeNull();
  else expect(shown).toBe(made);
}

/** `actor`'s own screen shows the secret choice it showed before the act. */
export async function seesSameSecretChoice(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  const earlier = secretChoiceOnScreen(screenBefore(w, actor));
  expect(earlier).not.toBeNull();
  expect(await w.s.read(ownCustomGameSecretChoiceShown, actor)).toBe(earlier);
}

/** None of `hidden` reaches `viewer`: not on their screen, not to their device. */
export async function reachesNone(
  w: HarnessWorld,
  viewer: string,
  hidden: readonly (string | null)[]
): Promise<void> {
  const secret = hidden.filter((choice): choice is string => choice !== null);
  expect(secret).not.toEqual([]);
  expect(await w.s.read(privateSetupsReaching, viewer, secret)).toEqual([]);
}

/** `actor`'s device has its connection back and shows the live custom game. */
export async function backOnline(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  await w.s.apply(restoreActorConnection, actor);
  await w.s.until((s) => customGameView(s, actor), {
    pred: (shown) => shown.connected,
    maxMs: SHOWN_WITHIN_MS,
  });
  await rememberCustomGame(w);
}
