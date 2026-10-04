import { expect } from 'bun:test';
import {
  multiplayerCommandReply,
  sendMultiplayerCommand,
} from '@libs/chess-harness/multiplayer-commands';
import {
  givenOpponentSearch,
  pairChessOpponents,
} from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import { multiplayerView } from '@libs/chess-matchmaking-harness/multiplayer-reads';
import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game';
import { accountIdOf } from '@libs/harness/identity';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { multiplayerPeople } from './multiplayer-people';

export async function givenGame(
  w: HarnessWorld,
  white = 'alice',
  black = 'bob'
) {
  await multiplayerPeople(w, [white, black]);
  await w.s.apply(givenOpponentSearch, white);
  await w.s.advanceTime(1);
  await w.s.apply(givenOpponentSearch, black);
  await w.s.apply(pairChessOpponents, white);
  await sameBoards(w, white, black);
  const game = (await w.s.read(multiplayerView, white)).game!;
  const owner = await w.s.read(accountIdOf, white);
  expect(game.white_id).toBe(owner!);
  w.memo.set('multiplayer:game', game);
  return game;
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
export async function move(
  w: HarnessWorld,
  actor: string,
  uci: string,
  revision?: number
) {
  const game = await gameOf(w);
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
export async function acceptedMoves(w: HarnessWorld, moves: readonly string[]) {
  for (let n = 0; n < moves.length; n++) {
    const reply = await move(w, n % 2 === 0 ? 'alice' : 'bob', moves[n]!);
    expect(reply.result.ok).toBe(true);
    await sameBoards(w, 'alice', 'bob', (game) => game.revision === n + 1);
  }
}
export async function resignation(w: HarnessWorld, actor: string) {
  const game = await gameOf(w);
  return command(w, actor, 'resignMultiplayer', {
    gameId: game.id,
    requestId: `resign-${actor}-${game.id}`,
  });
}
export async function refusal(w: HarnessWorld, actor: string, code: string) {
  const reply = (await w.s.read(multiplayerCommandReply, actor))!;
  expect(reply.result.ok).toBe(false);
  if (!reply.result.ok) expect(reply.result.failures[0]?.code).toBe(code);
}
export async function winner(w: HarnessWorld, actor: string, reason?: string) {
  const owner = await w.s.read(accountIdOf, actor);
  const game = await sameBoards(
    w,
    'alice',
    'bob',
    (g) => g.outcome !== 'ongoing'
  );
  expect(game.outcome).toBe(game.white_id === owner ? 'white' : 'black');
  if (reason !== undefined) expect(game.reason).toBe(reason);
}
