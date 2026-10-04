import type { RoomCommandPayload, RoomEvent, RoomModule, RoomState } from '@pkgs/room-shared/types';
import type fc from 'fast-check';

import type { DomainOp } from './actions';

export type RoomApp = {
  readonly module: RoomModule<RoomState, RoomCommandPayload, RoomEvent, string>;
  /** Arbitraries the `domain` pool action draws from (one per command shape). */
  readonly domainOpArbs: (ctx: {
    readonly clientIds: readonly string[];
  }) => fc.Arbitrary<DomainOp>[];
  /** Build the wire payload for a domain op (module-specific). */
  readonly toPayload: (op: DomainOp) => RoomCommandPayload;
};
