/**
 * A scenario's matched game, whichever game it is played in: the two people
 * paired, both people's boards, the commands each sends with its request id,
 * and what each is told. What differs per game — how its people get ready,
 * the time control in the game's clock namespace, its moves — is passed in.
 */

import { expect } from 'bun:test';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { accountIdOf } from '@libs/harness-ts/identity';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  multiplayerCommandReply,
  sendMultiplayerCommand,
} from './multiplayer-commands';
import { awaitGameMatch, givenOpponentSearch } from './multiplayer-fixtures';
import { multiplayerView } from './multiplayer-reads';

/** Each named person has an account and a space to play in. */
export type ReadyPeople = (
  w: HarnessWorld,
  people: readonly string[]
) => Promise<void>;

/** Two people paired at one time control, the first given the first side. */
export type Pairing = {
  readonly people: ReadyPeople;
  readonly first: string;
  readonly second: string;
  /** The time control both sought, in the game's clock namespace. */
  readonly timeControl: string;
};

/** Whether the scenario has paired people in a matched game. */
export function inMatchedGame(w: HarnessWorld): boolean {
  return w.memo.has('multiplayer:game');
}

/** A search the scenario set up, remembered with its time control. */
export async function searchFor(
  w: HarnessWorld,
  actor: string,
  timeControl: string
) {
  await w.s.apply(givenOpponentSearch, actor, timeControl);
  w.memo.set(`multiplayer:searching:${actor}`, timeControl);
  const search = (await w.s.read(multiplayerView, actor)).search;
  if (search !== null) w.memo.set('multiplayer:original-search', search);
}

/** A new matched game: both sought at one time control, then paired. */
export async function pairMatchedGame(w: HarnessWorld, pairing: Pairing) {
  const { first, second, timeControl } = pairing;
  await pairing.people(w, [first, second]);
  await w.s.apply(givenOpponentSearch, first, timeControl);
  await w.s.advanceTime(1);
  await w.s.apply(givenOpponentSearch, second, timeControl);
  await w.s.apply(awaitGameMatch, first, second, true);
  await sameBoards(w, first, second);
  const game = (await w.s.read(multiplayerView, first)).game!;
  expect(game.white_id).toBe(await ownerOf(w, first));
  w.memo.set('multiplayer:game', game);
  w.memo.set('multiplayer:pair', [first, second]);
  return game;
}

/** The two people of the scenario's matched game, the first side first. */
export function pairOf(w: HarnessWorld): readonly [string, string] {
  return (
    (w.memo.get('multiplayer:pair') as [string, string] | undefined) ?? [
      'alice',
      'bob',
    ]
  );
}

/** The other person of the scenario's matched game. */
export function opponentOf(w: HarnessWorld, actor: string): string {
  const [first, second] = pairOf(w);
  return actor === first ? second : first;
}

/**
 * The matched game `actor`'s device holds, or `null` without one: the game
 * as their screen knows it, in the record's durable field names.
 */
export async function heldMatchedGame(s: ProductHarness, actor: string) {
  return (await multiplayerView(s, actor)).game;
}

/** The matched game `actor`'s device holds. */
export async function matchedGameOf(w: HarnessWorld, actor = 'alice') {
  const game = (await w.s.read(multiplayerView, actor)).game;
  if (game === null) throw new Error(`${actor} has no matched game`);
  return game;
}

/**
 * The device a person looks at: their phone, or the online device the
 * scenario gave them while that phone is offline.
 */
export function viewerOf(w: HarnessWorld, person: string): string {
  return (
    (w.memo.get(`multiplayer:viewer:${person}`) as string | undefined) ?? person
  );
}

/** Two people's boards once they agree (and satisfy `predicate`). */
export async function sameBoards(
  w: HarnessWorld,
  person = 'alice',
  otherPerson = 'bob',
  predicate: (game: MultiplayerGame) => boolean = () => true
) {
  const first = viewerOf(w, person);
  const second = viewerOf(w, otherPerson);
  await w.s.until(async (s) => {
    const a = (await multiplayerView(s, first)).game;
    const b = (await multiplayerView(s, second)).game;
    return (
      a !== null &&
      b !== null &&
      JSON.stringify(a) === JSON.stringify(b) &&
      predicate(a)
    );
  });
  const a = await matchedGameOf(w, first);
  expect((await w.s.read(multiplayerView, second)).game).toEqual(a);
  return a;
}

/** Both people's boards for the scenario's matched game, once they agree. */
export function bothBoards(
  w: HarnessWorld,
  predicate: (game: MultiplayerGame) => boolean = () => true
) {
  const [first, second] = pairOf(w);
  return sameBoards(w, first, second, predicate);
}

/** A command from `actor`'s device, with a fresh request id, and its verdict. */
export async function command(
  w: HarnessWorld,
  actor: string,
  name: string,
  args: Record<string, unknown>
) {
  const sequence = Number(w.memo.get('multiplayer:command-sequence') ?? 0) + 1;
  w.memo.set('multiplayer:command-sequence', sequence);
  await w.s.apply(sendMultiplayerCommand, actor, {
    name,
    args: {
      requestId: `request-${String(sequence)}`,
      ...args,
    },
  });
  return (await w.s.read(multiplayerCommandReply, actor))!;
}

/** A command on the person's own current game, as their screen sends it. */
export async function gameCommand(
  w: HarnessWorld,
  actor: string,
  name: string
) {
  const game = await matchedGameOf(w, actor);
  return command(w, actor, name, { gameId: game.id });
}

/**
 * A move from `actor`'s device for the board it shows, or for an earlier
 * `revision` of it. The board it was made on is remembered.
 */
export async function move(
  w: HarnessWorld,
  actor: string,
  uci: string,
  revision?: number
) {
  const game = await matchedGameOf(w, actor);
  rememberBoardBeforeMove(w, game);
  const at = revision ?? game.revision;
  return command(w, actor, 'playMultiplayerMove', {
    gameId: game.id,
    revision: at,
    uci,
    requestId: `move-${game.id}-${actor}-${String(at)}-${uci}`,
  });
}

/** Remember the board a move is about to be made on. */
export function rememberBoardBeforeMove(
  w: HarnessWorld,
  game: MultiplayerGame
): void {
  w.memo.set('multiplayer:board-before-move', game);
}

/** The board the scenario's last move was made on, if one was made. */
export function boardBeforeMove(w: HarnessWorld): MultiplayerGame | null {
  return (
    (w.memo.get('multiplayer:board-before-move') as
      | MultiplayerGame
      | undefined) ?? null
  );
}

/** Accepted moves, the two people in turn, both boards agreeing after each. */
export async function acceptedMoves(w: HarnessWorld, moves: readonly string[]) {
  const [first, second] = pairOf(w);
  const start = (await matchedGameOf(w, first)).revision;
  for (let n = 0; n < moves.length; n++) {
    const reply = await move(
      w,
      (start + n) % 2 === 0 ? first : second,
      moves[n]!
    );
    expect(reply.result.ok).toBe(true);
    await sameBoards(
      w,
      first,
      second,
      (game) => game.revision === start + n + 1
    );
  }
}

export async function resignation(w: HarnessWorld, actor: string) {
  const game = await matchedGameOf(w, actor);
  return command(w, actor, 'resignMultiplayer', {
    gameId: game.id,
    requestId: `resign-${actor}-${game.id}`,
  });
}

/** The second side resigns, so the first side wins. */
export async function resignedBySecond(w: HarnessWorld) {
  const [first, second] = pairOf(w);
  expect((await resignation(w, second)).result.ok).toBe(true);
  return sameBoards(w, first, second, (g) => g.outcome !== 'ongoing');
}

/** The first side aborts the matched game. */
export async function abortedByFirst(w: HarnessWorld) {
  const [first, second] = pairOf(w);
  expect((await gameCommand(w, first, 'abortMultiplayer')).result.ok).toBe(
    true
  );
  return sameBoards(w, first, second, (g) => g.outcome === 'aborted');
}

/** The first side offers a draw and the second side accepts it. */
export async function drawnByAgreement(w: HarnessWorld) {
  const [first, second] = pairOf(w);
  expect((await gameCommand(w, first, 'offerMultiplayerDraw')).result.ok).toBe(
    true
  );
  expect(
    (await gameCommand(w, second, 'acceptMultiplayerDraw')).result.ok
  ).toBe(true);
  return sameBoards(w, first, second, (g) => g.outcome === 'draw');
}

/** The last command from `actor`'s device was refused with `code`. */
export async function refusal(w: HarnessWorld, actor: string, code: string) {
  const reply = (await w.s.read(multiplayerCommandReply, actor))!;
  expect(reply.result.ok).toBe(false);
  if (!reply.result.ok)
    expect(reply.result.failures[0]).toMatchObject({ code });
}

/** Both people see `actor` won the matched game (`reason`, when given). */
export async function winner(w: HarnessWorld, actor: string, reason?: string) {
  const owner = await w.s.read(accountIdOf, actor);
  const game = await bothBoards(w, (g) => g.outcome !== 'ongoing');
  expect(game.outcome).toBe(game.white_id === owner ? 'white' : 'black');
  if (reason !== undefined) expect(game.reason).toBe(reason);
}

export async function ownerOf(w: HarnessWorld, actor: string) {
  const owner = await w.s.read(accountIdOf, actor);
  if (owner === null) throw new Error(`${actor} has no account`);
  return owner;
}
