import { fc } from '@pkgs/pbt';
import type { SeededRng } from '@pkgs/uuid';
import type { DomainOp, RoomApp } from '../../../sim/system';
import { domainOp } from '../../../sim/system';
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

export function pickAuthzDomainOp(
  rng: SeededRng,
  clientIds: readonly string[]
): DomainOp {
  const clientId = clientIds[rng.int(clientIds.length)] ?? 'c0';
  return domainOp(clientId, rng.random() < 0.4 ? 'claim' : 'bump');
}

export function authzToPayload(op: DomainOp) {
  if (op.command === 'bump') return Bump({});
  return Claim({});
}

export const authzApp: RoomApp = {
  module: AuthzFixtureModule,
  domainOpArbs: authzDomainOpArbs,
  pickDomainOp: pickAuthzDomainOp,
  toPayload: authzToPayload,
};
