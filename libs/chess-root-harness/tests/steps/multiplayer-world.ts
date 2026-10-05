import { expect } from 'bun:test';
import {
  multiplayerCommandReply,
  sendMultiplayerCommand,
} from '@libs/chess-matchmaking-harness/multiplayer-commands';
import {
  awaitChessMatch,
  givenOpponentSearch,
} from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import { multiplayerView } from '@libs/chess-matchmaking-harness/multiplayer-reads';
import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import { accountIdOf } from '@libs/harness/identity';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { multiplayerPeople } from './multiplayer-people';

/** A search the scenario set up, remembered with its time control. */
export async function searchFor(
  w: HarnessWorld,
  actor: string,
  timeControl: string
) {
  await w.s.apply(givenOpponentSearch, actor, timeControl);
  w.memo.set(`multiplayer:searching:${actor}`, timeControl);
}

/** A new game with the named colours: both searched at one time control, then paired. */
export async function givenGame(
  w: HarnessWorld,
  white = 'alice',
  black = 'bob',
  timeControl = '5+0'
) {
  await multiplayerPeople(w, [white, black]);
  await w.s.apply(givenOpponentSearch, white, timeControl);
  await w.s.advanceTime(1);
  await w.s.apply(givenOpponentSearch, black, timeControl);
  await w.s.apply(awaitChessMatch, white, black, true);
  await sameBoards(w, white, black);
  const game = (await w.s.read(multiplayerView, white)).game!;
  const owner = await w.s.read(accountIdOf, white);
  expect(game.white_id).toBe(owner!);
  w.memo.set('multiplayer:game', game);
  w.memo.set('multiplayer:pair', [white, black]);
  return game;
}

/** The two people of the scenario's game, White first. */
export function pairOf(w: HarnessWorld): readonly [string, string] {
  return (
    (w.memo.get('multiplayer:pair') as [string, string] | undefined) ?? [
      'alice',
      'bob',
    ]
  );
}

export async function gameOf(w: HarnessWorld, actor = 'alice') {
  const game = (await w.s.read(multiplayerView, actor)).game;
  if (game === null) throw new Error(`${actor} has no multiplayer board`);
  return game;
}

export async function sameBoards(
  w: HarnessWorld,
  first = 'alice',
  second = 'bob',
  predicate: (game: MultiplayerGame) => boolean = () => true
) {
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
  const a = await gameOf(w, first);
  expect((await w.s.read(multiplayerView, second)).game).toEqual(a);
  return a;
}

/** Both people's boards for the scenario's game, once they agree. */
export function bothBoards(
  w: HarnessWorld,
  predicate: (game: MultiplayerGame) => boolean = () => true
) {
  const [white, black] = pairOf(w);
  return sameBoards(w, white, black, predicate);
}

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
      requestId: w.memo.get('multiplayer:request') ?? `request-${sequence}`,
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
  const game = await gameOf(w, actor);
  return command(w, actor, name, { gameId: game.id });
}

export async function move(
  w: HarnessWorld,
  actor: string,
  uci: string,
  revision?: number
) {
  const game = await gameOf(w, actor);
  w.memo.set('multiplayer:board-before-move', game.fen);
  const requestId = `move-${game.id}-${actor}-${revision ?? game.revision}-${uci}`;
  const reply = await command(w, actor, 'playMultiplayerMove', {
    gameId: game.id,
    revision: revision ?? game.revision,
    uci,
    requestId,
  });
  w.memo.set(`multiplayer:last:${actor}`, reply.command);
  return reply;
}

/** Accepted moves, White and Black in turn, both boards agreeing after each. */
export async function acceptedMoves(w: HarnessWorld, moves: readonly string[]) {
  const [white, black] = pairOf(w);
  const start = (await gameOf(w, white)).revision;
  for (let n = 0; n < moves.length; n++) {
    const reply = await move(w, (start + n) % 2 === 0 ? white : black, moves[n]!);
    expect(reply.result.ok).toBe(true);
    await sameBoards(w, white, black, (game) => game.revision === start + n + 1);
  }
}

/** A game in which both people have made their first move (e4 and e5). */
export async function givenBegunGame(
  w: HarnessWorld,
  white = 'alice',
  black = 'bob',
  timeControl = '5+0'
) {
  await givenGame(w, white, black, timeControl);
  await acceptedMoves(w, ['e2e4', 'e7e5']);
}

export async function resignation(w: HarnessWorld, actor: string) {
  const game = await gameOf(w, actor);
  return command(w, actor, 'resignMultiplayer', {
    gameId: game.id,
    requestId: `resign-${actor}-${game.id}`,
  });
}

/** A finished game: both moved, then Black resigned, so White won. */
export async function givenOverGame(
  w: HarnessWorld,
  white = 'alice',
  black = 'bob',
  timeControl = '5+0'
) {
  await givenBegunGame(w, white, black, timeControl);
  expect((await resignation(w, black)).result.ok).toBe(true);
  return sameBoards(w, white, black, (g) => g.outcome !== 'ongoing');
}

export async function givenAbortedGame(
  w: HarnessWorld,
  white = 'alice',
  black = 'bob',
  timeControl = '5+0'
) {
  await givenGame(w, white, black, timeControl);
  expect((await gameCommand(w, white, 'abortMultiplayer')).result.ok).toBe(
    true
  );
  return sameBoards(w, white, black, (g) => g.outcome === 'aborted');
}

export async function givenDrawnByAgreement(w: HarnessWorld) {
  const [white, black] = pairOf(w);
  expect((await gameCommand(w, white, 'offerMultiplayerDraw')).result.ok).toBe(
    true
  );
  expect((await gameCommand(w, black, 'acceptMultiplayerDraw')).result.ok).toBe(
    true
  );
  return sameBoards(w, white, black, (g) => g.outcome === 'draw');
}

export async function refusal(w: HarnessWorld, actor: string, code: string) {
  const reply = (await w.s.read(multiplayerCommandReply, actor))!;
  expect(reply.result.ok).toBe(false);
  if (!reply.result.ok) expect(reply.result.failures[0]?.code).toBe(code);
}

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
