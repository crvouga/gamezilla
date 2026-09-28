import type {
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomState,
} from '@pkgs/room';
import type fc from 'fast-check';
import type { RoomHarnessAuthorize } from '../api';

import type { DomainOp } from './actions';

export type RoomApp = {
  readonly module: RoomModule<RoomState, RoomCommandPayload, RoomEvent, string>;
  /** Arbitraries the `domain` pool action draws from (one per command shape). */
  readonly domainOpArbs: (ctx: {
    readonly clientIds: readonly string[];
  }) => fc.Arbitrary<DomainOp>[];
  /** Build the wire payload for a domain op (module-specific). */
  readonly toPayload: (op: DomainOp) => RoomCommandPayload;
  readonly authorize?: RoomHarnessAuthorize;
};
