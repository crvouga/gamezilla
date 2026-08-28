import { fc } from '@pkgs/pbt';
import type { SeededRng } from '@pkgs/uuid';
import type { DomainOp } from '../../dst/actions';
import type { RoomDstApp } from '../../dst/app';
import { domainOp } from '../../dst/model';
import {
  Decrement,
  Increment,
  TestCounterModule,
} from '../../fixtures/counter-module';

export function counterDomainOpArbs(ctx: {
  readonly clientIds: readonly string[];
}): fc.Arbitrary<DomainOp>[] {
  const pick = fc.constantFrom(...ctx.clientIds);
  return [
    pick.map((clientId) => domainOp(clientId, 'increment')),
    pick.map((clientId) => domainOp(clientId, 'decrement')),
  ];
}

export function pickCounterDomainOp(
  rng: SeededRng,
  clientIds: readonly string[]
): DomainOp {
  const clientId = clientIds[rng.int(clientIds.length)] ?? 'c0';
  return domainOp(clientId, rng.random() < 0.7 ? 'increment' : 'decrement');
}

export function counterToPayload(op: DomainOp) {
  if (op.command === 'decrement') return Decrement({});
  return Increment({});
}

export const counterDstApp: RoomDstApp = {
  module: TestCounterModule,
  domainOpArbs: counterDomainOpArbs,
  pickDomainOp: pickCounterDomainOp,
  toPayload: counterToPayload,
};
