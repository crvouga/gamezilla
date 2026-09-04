import type { SeededRng } from '@pkgs/uuid';
import type fc from 'fast-check';
import type { RoomSimWorld } from '../../sim/world-api';
import type { RoomModule, RoomState } from '../../types';

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

export type RoomDstApp<
  S extends RoomState = RoomState,
  C = unknown,
  E = unknown,
> = {
  readonly module: RoomModule<S, C & object, E & object, string>;
  readonly domainOpArbs: (ctx: {
    readonly clientIds: readonly string[];
  }) => fc.Arbitrary<DomainOp>[];
  readonly pickDomainOp: (
    rng: SeededRng,
    clientIds: readonly string[]
  ) => DomainOp;
  /** Build the wire payload for a domain op (module-specific). */
  readonly toPayload: (op: DomainOp) => C;
  readonly domainModel?: DomainModelHooks;
  /** Optional authorize hook wired into openRoomSimWorld. */
  readonly authorize?: RoomSimWorld['server'] extends never
    ? never
    : OpenRoomAuthorize;
};

type OpenRoomAuthorize = NonNullable<
  Parameters<typeof import('../../sim/world').openRoomSimWorld>[0]['authorize']
>;
