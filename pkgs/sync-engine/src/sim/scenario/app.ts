import type fc from 'fast-check';

import type { SimDomainPack } from '../domain-pack';
import type { RestartClientOpts } from '../kit-lifecycle';
import type { SeededRng } from '../rng';
import type { DomainOp, ServerOp } from './actions';
import type { SyncSurfaceBase } from './surface-types';

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

export type SyncApp = {
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
    (surface: SyncSurfaceBase, args: Record<string, unknown>) => Promise<void>
  >;
  readonly domainModel?: DomainModelHooks;
  /** App-specific schema restart options for `restartWithSchema` actions. */
  readonly restartOptsForVariant?: (variant: string) => RestartClientOpts;
};
