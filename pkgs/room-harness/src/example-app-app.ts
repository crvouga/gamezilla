import { AddOne, ClaimOutOfTime, ClaimRoom, gameRoomModule, Move, StartMatch, TakeOne, TurnAway } from './game-room';
import fc from 'fast-check';
import type { DomainOp } from './actions';
import type { RoomApp } from './scenario-app';
import { domainOp } from './actions';

/** The time each player starts a pool-drawn match with, in ms. */
const POOL_MATCH_MS = 5_000;

function whole(v: unknown, fallback: number): number {
  return typeof v === 'number' ? v : fallback;
}

/** One arbitrary per command of the game room, from any device in it. */
export function exampleDomainOpArbs(ctx: {
  readonly clientIds: readonly string[];
}): fc.Arbitrary<DomainOp>[] {
  const pick = fc.constantFrom(...ctx.clientIds);
  return [
    pick.map((clientId) => domainOp(clientId, 'add-one')),
    pick.map((clientId) => domainOp(clientId, 'take-one')),
    pick.map((clientId) => domainOp(clientId, 'claim')),
    fc
      .tuple(pick, pick)
      .map(([clientId, person]) => domainOp(clientId, 'turn-away', { person })),
    pick.map((clientId) =>
      domainOp(clientId, 'start-match', {
        whiteMs: POOL_MATCH_MS,
        blackMs: POOL_MATCH_MS,
      })
    ),
    pick.map((clientId) => domainOp(clientId, 'move')),
    fc
      .tuple(pick, fc.constantFrom('white' as const, 'black' as const))
      .map(([clientId, player]) =>
        domainOp(clientId, 'claim-out-of-time', { player })
      ),
  ];
}

/** The command a domain op sends. */
export function exampleToPayload(op: DomainOp) {
  switch (op.command) {
    case 'take-one':
      return TakeOne({});
    case 'claim':
      return ClaimRoom({});
    case 'turn-away':
      return TurnAway({ person: String(op.args['person']) });
    case 'start-match':
      return StartMatch({
        whiteMs: whole(op.args['whiteMs'], POOL_MATCH_MS),
        blackMs: whole(op.args['blackMs'], POOL_MATCH_MS),
      });
    case 'move':
      return Move({});
    case 'claim-out-of-time':
      return ClaimOutOfTime({
        player: op.args['player'] === 'black' ? 'black' : 'white',
      });
    default:
      return AddOne({});
  }
}

/**
 * The room framework's one example app — the game room from
 * `@pkgs/room/harness` — as the room harness runs it. Every spec, model
 * binding and test of the room packages drives this app.
 */
export const exampleApp: RoomApp = {
  module: gameRoomModule,
  domainOpArbs: exampleDomainOpArbs,
  toPayload: exampleToPayload,
};
