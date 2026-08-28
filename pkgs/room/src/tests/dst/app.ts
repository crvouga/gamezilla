import type { SeededRng } from '@pkgs/uuid';
import type fc from 'fast-check';

import type { RoomSimAuthorize } from '../../sim/world-api';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomState,
} from '../../types';

import type { DomainOp } from './actions';

export type DomainModelHooks = {
  readonly initial: () => unknown;
  readonly allows: (model: unknown, op: DomainOp) => boolean;
  readonly apply: (model: unknown, op: DomainOp) => void;
  readonly clientAllows?: (
    model: unknown,
    op: DomainOp,
    clientLive: boolean
  ) => boolean;
  readonly onHeal?: (model: unknown) => void;
};

export type RoomDstApp = {
  readonly module: RoomModule<RoomState, RoomCommandPayload, RoomEvent, string>;
  readonly domainOpArbs: (ctx: {
    readonly clientIds: readonly string[];
  }) => fc.Arbitrary<DomainOp>[];
  readonly pickDomainOp: (
    rng: SeededRng,
    clientIds: readonly string[]
  ) => DomainOp;
  /** Build the wire payload for a domain op (module-specific). */
  readonly toPayload: (op: DomainOp) => RoomCommandPayload;
  readonly domainModel?: DomainModelHooks;
  readonly authorize?: RoomSimAuthorize;
};
