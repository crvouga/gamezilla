import fc from 'fast-check';
import { Decrement, Increment, TestCounterModule } from '../counter-module';
import type { DomainOp, RoomApp } from '../scenario';
import { domainOp } from '../scenario';

export function counterDomainOpArbs(ctx: {
  readonly clientIds: readonly string[];
}): fc.Arbitrary<DomainOp>[] {
  const pick = fc.constantFrom(...ctx.clientIds);
  return [
    pick.map((clientId) => domainOp(clientId, 'increment')),
    pick.map((clientId) => domainOp(clientId, 'decrement')),
  ];
}

export function counterToPayload(op: DomainOp) {
  if (op.command === 'decrement') return Decrement({});
  return Increment({});
}

export const counterApp: RoomApp = {
  module: TestCounterModule,
  domainOpArbs: counterDomainOpArbs,
  toPayload: counterToPayload,
};
