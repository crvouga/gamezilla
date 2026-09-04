import fc from 'fast-check';
import { AuthzFixtureModule, Bump, Claim } from '../authz-module';
import type { DomainOp, RoomApp } from '../scenario';
import { domainOp } from '../scenario';

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
