import { fc } from '@pkgs/pbt';
import type { SeededRng } from '@pkgs/uuid';
import type { DomainOp } from '../../dst/actions';
import type { RoomDstApp } from '../../dst/app';
import { domainOp } from '../../dst/model';
import {
  FlagFall,
  MatchClockFixtureModule,
  Move,
  StartMatch,
} from '../../fixtures/match-clock-module';

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

export function pickMatchClockDomainOp(
  rng: SeededRng,
  clientIds: readonly string[]
): DomainOp {
  const clientId = clientIds[rng.int(clientIds.length)] ?? 'c0';
  const roll = rng.random();
  if (roll < 0.25) {
    return domainOp(clientId, 'start', { whiteMs: 3_000, blackMs: 3_000 });
  }
  if (roll < 0.7) {
    return domainOp(clientId, 'move');
  }
  return domainOp(clientId, 'flag-fall', {
    seat: rng.random() < 0.5 ? 'white' : 'black',
  });
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

export const matchClockDstApp: RoomDstApp = {
  module: MatchClockFixtureModule,
  domainOpArbs: matchClockDomainOpArbs,
  pickDomainOp: pickMatchClockDomainOp,
  toPayload: matchClockToPayload,
};
