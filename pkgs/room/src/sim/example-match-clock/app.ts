import fc from 'fast-check';
import {
  FlagFall,
  MatchClockFixtureModule,
  Move,
  StartMatch,
} from '../match-clock-module';
import type { DomainOp, RoomApp } from '../scenario';
import { domainOp } from '../scenario';

export function matchClockDomainOpArbs(ctx: {
  readonly clientIds: readonly string[];
}): fc.Arbitrary<DomainOp>[] {
  const pick = fc.constantFrom(...ctx.clientIds);
  return [
    pick.map((clientId) =>
      domainOp(clientId, 'start', { whiteMs: 5_000, blackMs: 5_000 })
    ),
    pick.map((clientId) => domainOp(clientId, 'move')),
    pick.map((clientId) => domainOp(clientId, 'flag-fall', { seat: 'white' })),
    pick.map((clientId) => domainOp(clientId, 'flag-fall', { seat: 'black' })),
  ];
}

export function matchClockToPayload(op: DomainOp) {
  if (op.command === 'start') {
    const whiteMs =
      typeof op.args['whiteMs'] === 'number' ? op.args['whiteMs'] : 5_000;
    const blackMs =
      typeof op.args['blackMs'] === 'number' ? op.args['blackMs'] : 5_000;
    return StartMatch({ whiteMs, blackMs });
  }
  if (op.command === 'flag-fall') {
    const seat = op.args['seat'] === 'black' ? 'black' : 'white';
    return FlagFall({ seat });
  }
  return Move({});
}

export const matchClockApp: RoomApp = {
  module: MatchClockFixtureModule,
  domainOpArbs: matchClockDomainOpArbs,
  toPayload: matchClockToPayload,
};
