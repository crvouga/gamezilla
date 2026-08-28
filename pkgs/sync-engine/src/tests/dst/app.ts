import type fc from 'fast-check';

import type { SimDomainPack } from '../../sim/domain-pack';
import type { SeededRng } from '../../sim/rng';
import type { SimWorld } from '../../sim/world-api';
import type { DomainOp, ServerOp } from './actions';

export type DomainModelHooks = {
  readonly initial: () => unknown;
  readonly allows: (model: unknown, op: DomainOp | ServerOp) => boolean;
  readonly apply: (model: unknown, op: DomainOp | ServerOp) => void;
  readonly clientAllows?: (
    model: unknown,
    op: DomainOp,
    clientLive: boolean
  ) => boolean;
  readonly onHeal?: (model: unknown) => void;
};

export type DstApp = {
  readonly pack: SimDomainPack;
  readonly domainOpArbs: (ctx: {
    readonly clientIds: readonly string[];
  }) => fc.Arbitrary<DomainOp>[];
  readonly serverOpArbs?: (ctx: {
    readonly clientIds: readonly string[];
  }) => fc.Arbitrary<ServerOp>[];
  readonly pickDomainOrServerOp: (
    rng: SeededRng,
    clientIds: readonly string[]
  ) => DomainOp | ServerOp;
  readonly serverOps?: Record<
    string,
    (world: SimWorld, args: Record<string, unknown>) => Promise<void>
  >;
  readonly domainModel?: DomainModelHooks;
};
