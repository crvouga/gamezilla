import fc from 'fast-check';
import type { DomainOp, RoomApp } from '../../../sim/scenario';
import { domainOp } from '../../../sim/scenario';
import { AuthzFixtureModule, Bump, Claim } from '../../fixtures/authz-module';

export function authzDomainOpArbs(ctx: {
  readonly clientIds: readonly string[];
}): fc.Arbitrary<DomainOp>[] {
  const pick = fc.constantFrom(...ctx.clientIds);
  return [
    pick.map((clientId) => domainOp(clientId, 'claim')),
    pick.map((clientId) => domainOp(clientId, 'bump')),
  ];
}

export function authzToPayload(op: DomainOp) {
  if (op.command === 'bump') return Bump({});
  return Claim({});
}

export const authzApp: RoomApp = {
  module: AuthzFixtureModule,
  domainOpArbs: authzDomainOpArbs,
  toPayload: authzToPayload,
};
