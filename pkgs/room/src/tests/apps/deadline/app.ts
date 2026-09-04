import fc from 'fast-check';
import type { DomainOp, RoomApp } from '../../../sim/scenario';
import { domainOp } from '../../../sim/scenario';
import {
  ActBeforeDeadline,
  DeadlineFixtureModule,
  ExpireDeadline,
  StartDeadline,
} from '../../fixtures/deadline-module';

export function deadlineDomainOpArbs(ctx: {
  readonly clientIds: readonly string[];
}): fc.Arbitrary<DomainOp>[] {
  const pick = fc.constantFrom(...ctx.clientIds);
  return [
    pick.map((clientId) => domainOp(clientId, 'start', { durationMs: 100 })),
    pick.map((clientId) => domainOp(clientId, 'act')),
    pick.map((clientId) => domainOp(clientId, 'expire')),
  ];
}

export function deadlineToPayload(op: DomainOp) {
  if (op.command === 'start') {
    const durationMs =
      typeof op.args['durationMs'] === 'number' ? op.args['durationMs'] : 100;
    return StartDeadline({ durationMs });
  }
  if (op.command === 'expire') return ExpireDeadline({});
  return ActBeforeDeadline({});
}

export const deadlineApp: RoomApp = {
  module: DeadlineFixtureModule,
  domainOpArbs: deadlineDomainOpArbs,
  toPayload: deadlineToPayload,
};
