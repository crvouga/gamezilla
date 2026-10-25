/**
 * The custom game the secret-choices model follows, of the trace's game:
 * Alice created it and plays the first side, Bob the second, Carol the
 * third and a bot the fourth; Eve watches, and an observer who never loses
 * the connection reads what everyone in the space is shown. Each person's
 * secret choice is one the game's rules offer from their own hand, and each
 * move a person makes is the game's own choice from their hand.
 */

import { operateCustomGame } from '@libs/game-session-harness-ts/custom-game-controls';
import { establishCustomGame } from '@libs/game-session-harness-ts/custom-game-lineup';
import { makeCustomGameMove } from '@libs/game-session-harness-ts/custom-game-moves';
import type { CustomGameProbe } from '@libs/game-session-harness-ts/custom-game-probe';
import { readCustomGameProbe } from '@libs/game-session-harness-ts/custom-game-probe';
import { makeCustomGameSecretChoice } from '@libs/game-session-harness-ts/custom-game-secret-choice';
import type { TurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { splitCommittedProposal } from '@libs/game-session-harness-ts/played-rules';
import type { CustomGame } from '@libs/game-session-shared-ts/custom-game-state';
import {
  partition,
  refreshActorConnection,
  restoreActorConnection,
} from '@libs/harness-ts/actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import { turnConformanceGameOf } from '../conformance-world';

/** The model's people; Eve watches. */
export const CHOICE_PEOPLE = ['alice', 'bob', 'carol', 'eve'] as const;
/** In the space on no side, never losing the connection: whose screen shows the custom game to everyone online. */
export const CHOICE_OBSERVER = 'charlie';
/** The model's sides, first to fourth. */
export const MODEL_SIDES = ['first', 'second', 'third', 'fourth'] as const;
/** The model's bound on moves between rounds of secret choices. */
const MAX_MOVES = 2;
/** How long a decision may take to reach the observer. */
const SHOWN_WITHIN_MS = 10_000;
/** How long play may take to reach the next round or the end. */
const PLAY_WITHIN = 2_000;

export function choiceGameOf(w: QuintHarnessWorld): TurnHarnessGame {
  return turnConformanceGameOf(w.ctx.variant, w.ctx.title);
}

/** The model's side for the game's `side`. */
export function modelSide(w: QuintHarnessWorld, side: GameSide): string {
  const index = gameSides(choiceGameOf(w).shared.turnGame.rules).indexOf(side);
  return MODEL_SIDES[index] ?? side;
}

/** The game's side for the model's `side`. */
export function gameSide(w: QuintHarnessWorld, side: string): GameSide {
  const index = MODEL_SIDES.indexOf(side as (typeof MODEL_SIDES)[number]);
  const found = gameSides(choiceGameOf(w).shared.turnGame.rules)[index];
  if (found === undefined) throw new Error(`No side ${side}`);
  return found;
}

/** The people by member identity. */
export function choicePeople(w: QuintHarnessWorld): Map<string, string> {
  const known = w.memo.get('choice-people');
  if (known instanceof Map) return known as Map<string, string>;
  const people = new Map<string, string>();
  w.memo.set('choice-people', people);
  return people;
}

export async function probeOf(
  w: QuintHarnessWorld,
  actor: string
): Promise<CustomGameProbe> {
  const probe = await w.quiet.read(readCustomGameProbe, actor);
  if (probe === null) throw new Error(`${actor} sees no custom game`);
  return probe;
}

/** The custom game as everyone online is shown it. */
export async function shownGame(w: QuintHarnessWorld): Promise<CustomGame> {
  const game = (await probeOf(w, CHOICE_OBSERVER)).current;
  if (game === null) throw new Error('The observer sees no custom game');
  return game;
}

/** The custom game under way, awaiting its first round of secret choices. */
export async function prepareChoiceModel(w: QuintHarnessWorld): Promise<void> {
  await w.s.apply(establishCustomGame, choiceGameOf(w).shared.id, {
    host: 'alice',
    first: 'alice',
    second: 'bob',
    third: 'carol',
    fourth: 'bot',
    watchers: ['eve', CHOICE_OBSERVER],
  });
  for (const person of [...CHOICE_PEOPLE, CHOICE_OBSERVER])
    choicePeople(w).set((await probeOf(w, person)).myId, person);
}

/** Which secret choices of the open round the binding made, by model side and model choice. */
function madeChoices(w: QuintHarnessWorld): Map<string, string> {
  const made = w.memo.get('made-choices');
  if (made instanceof Map) return made as Map<string, string>;
  const fresh = new Map<string, string>();
  w.memo.set('made-choices', fresh);
  return fresh;
}

/** The model's choice name `side`'s secret choice `shown` was made as, if the binding made it. */
export function madeChoiceName(
  w: QuintHarnessWorld,
  side: string,
  shown: string
): string | undefined {
  for (const [key, value] of madeChoices(w))
    if (value === shown && key.startsWith(`${side}|`)) return key.split('|')[1];
  return undefined;
}

/** What a bot or stand-in chose by itself, as the trace named it. */
export function decidedChoices(w: QuintHarnessWorld): Map<string, string> {
  const decided = w.memo.get('decided-choices');
  if (decided instanceof Map) return decided as Map<string, string>;
  const fresh = new Map<string, string>();
  w.memo.set('decided-choices', fresh);
  return fresh;
}

/**
 * `actor` makes the secret choice the model calls `choice`: the first or
 * second the game's rules offer from their own hand (a watcher, holding
 * none, tries the known line's first one).
 */
export async function makeModelSecretChoice(
  w: QuintHarnessWorld,
  actor: string,
  choice: string
): Promise<void> {
  const game = choiceGameOf(w);
  const probe = await probeOf(w, actor);
  const current = probe.current;
  if (current === null) throw new Error(`${actor} sees no custom game`);
  const hands = game.shared.turnGame.rules.hands;
  const offered =
    probe.ownHand === null || hands === undefined
      ? (splitCommittedProposal(game.fixtures.firstSideVictory[0] ?? '') ?? [])
      : hands.proposals(current.fen, probe.ownHand);
  const commitment = offered[choice === 'one choice' ? 0 : 1] ?? offered[0];
  if (commitment === undefined) throw new Error(`${actor} has no choice`);
  if (probe.mySide !== null)
    madeChoices(w).set(`${modelSide(w, probe.mySide)}|${choice}`, commitment);
  await w.s.apply(makeCustomGameSecretChoice, actor, {
    gameId: game.shared.id,
    commitment,
    ply: current.moves.length,
  });
}

/** A bot or stand-in on model side `side` makes its secret choice by itself. */
export async function awaitOwnSecretChoice(
  w: QuintHarnessWorld,
  side: string,
  choice: string
): Promise<void> {
  const own = gameSide(w, side);
  await w.s.until((s) => readCustomGameProbe(s, CHOICE_OBSERVER), {
    pred: (shown) => shown?.current?.committed.includes(own) === true,
    maxMs: SHOWN_WITHIN_MS,
  });
  decidedChoices(w).set(side, choice);
}

/** Moves made since the latest round of secret choices took effect, by the game's rules. */
export function movesSinceRound(
  w: QuintHarnessWorld,
  game: CustomGame
): { readonly rounds: number; readonly since: number } {
  const rules = choiceGameOf(w).shared.turnGame.rules;
  const actions = game.moves.map((move) => move.uci);
  let rounds = 0;
  let since = 0;
  for (let ply = 0; ply < actions.length; ply += 1) {
    const before = rules.replay(actions, ply);
    if ((rules.hands?.commit?.sides(before) ?? []).length > 0) {
      rounds += 1;
      since = 0;
    } else since += 1;
  }
  return { rounds, since };
}

/** Whether `game` is shown under way, with no round of secret choices open. */
function playing(game: CustomGame): boolean {
  return game.status === 'active' && game.awaiting.length === 0;
}

/**
 * One move by whoever the rules say moves next: a person's own choice from
 * their hand on their board, or a bot's or stand-in's, made by itself.
 */
async function nextMove(w: QuintHarnessWorld, game: CustomGame) {
  const played = game.moves.length;
  const seat = game[game.turn];
  const person = choicePeople(w).get(seat.person);
  if (
    seat.kind === 'person' &&
    person !== undefined &&
    !game.standIns.includes(game.turn)
  ) {
    const probe = await probeOf(w, person);
    const move = choiceGameOf(w).shared.automation.turns.choose(
      game.fen,
      () => 0,
      probe.ownHand
    );
    if (move === null) throw new Error(`${person} has no move`);
    await w.s.apply(
      makeCustomGameMove,
      person,
      choiceGameOf(w).shared.id,
      move
    );
  }
  await w.s.until((s) => readCustomGameProbe(s, CHOICE_OBSERVER), {
    pred: (shown) => (shown?.current?.moves.length ?? 0) > played,
    maxMs: SHOWN_WITHIN_MS,
  });
}

/** Whether every side has someone to play it now: its person connected, the bot or a stand-in. */
async function everySidePlayed(w: QuintHarnessWorld, game: CustomGame) {
  for (const side of game.sides) {
    const person = choicePeople(w).get(game[side].person);
    if (game[side].kind !== 'person' || game.standIns.includes(side)) continue;
    if (person === undefined || !(await probeOf(w, person)).connected)
      return false;
  }
  return true;
}

/** One move by whoever the rules say moves next, within the model's bound. */
export async function playModelMove(w: QuintHarnessWorld): Promise<void> {
  const game = await shownGame(w);
  if (!playing(game) || movesSinceRound(w, game).since >= MAX_MOVES) return;
  if (!(await everySidePlayed(w, game))) return;
  await nextMove(w, game);
}

/**
 * Play goes on, each move by whoever the rules say and each round's secret
 * choices made as they come, until `done` holds.
 */
export async function playOn(
  w: QuintHarnessWorld,
  done: (game: CustomGame) => boolean
): Promise<void> {
  for (let turn = 0; turn < PLAY_WITHIN; turn += 1) {
    const game = await shownGame(w);
    if (done(game)) return;
    if (game.status !== 'active') throw new Error('Play ended early');
    if (game.awaiting.length > 0) await chooseForPeople(w, game);
    else await nextMove(w, game);
  }
  throw new Error('Play did not get there');
}

/** Every person still to choose makes their first offered secret choice; bots and stand-ins choose by themselves. */
async function chooseForPeople(w: QuintHarnessWorld, game: CustomGame) {
  for (const side of game.awaiting) {
    const person = choicePeople(w).get(game[side].person);
    if (
      game[side].kind === 'person' &&
      person !== undefined &&
      !game.standIns.includes(side)
    )
      await makeModelSecretChoice(w, person, 'one choice');
  }
  await w.s.until((s) => readCustomGameProbe(s, CHOICE_OBSERVER), {
    pred: (shown) => shown?.current?.awaiting.length === 0,
    maxMs: SHOWN_WITHIN_MS,
  });
}

/** Play goes on until the next round of secret choices opens. */
export async function reachModelRound(w: QuintHarnessWorld): Promise<void> {
  const start = movesSinceRound(w, await shownGame(w)).rounds;
  await playOn(
    w,
    (game) =>
      game.awaiting.length > 0 && movesSinceRound(w, game).rounds === start
  );
  madeChoices(w).clear();
  decidedChoices(w).clear();
}

/** Play goes on until the game's rules finish the custom game. */
export async function finishModelGame(w: QuintHarnessWorld): Promise<void> {
  await playOn(w, (game) => game.status === 'completed');
}

/** `actor` stays away until a stand-in plays their side. */
export async function awaitStandIn(
  w: QuintHarnessWorld,
  actor: string
): Promise<void> {
  const side = (await probeOf(w, actor)).mySide;
  if (side === null) throw new Error(`${actor} has no side`);
  await w.s.until((s) => readCustomGameProbe(s, CHOICE_OBSERVER), {
    pred: (shown) => shown?.current?.standIns.includes(side) === true,
    maxMs: 90_000,
  });
}

export async function takeBackModelSide(
  w: QuintHarnessWorld,
  actor: string
): Promise<void> {
  await w.s.apply(operateCustomGame, actor, { operation: 'reclaim' });
}

export async function loseModelConnection(
  w: QuintHarnessWorld,
  actor: string
): Promise<void> {
  await w.s.apply(partition, actor);
  await w.s.apply(refreshActorConnection, actor);
}

export async function modelConnectionReturns(
  w: QuintHarnessWorld,
  actor: string
): Promise<void> {
  await w.s.apply(restoreActorConnection, actor);
  await w.s.until((s) => readCustomGameProbe(s, actor), {
    pred: (shown) => shown?.connected === true,
    maxMs: SHOWN_WITHIN_MS,
  });
}
