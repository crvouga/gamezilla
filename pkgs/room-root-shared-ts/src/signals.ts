import type { RoomRuntime } from './runtime';
import type { RoomCommandPayload, RoomState } from './types';

/**
 * Transient intents share the authenticated room connection. They are never
 * logged, deduplicated in storage, predicted by room's event fold, or queued
 * offline. A consumer supplies bounded sequence/ack state in its typed payload.
 */
export type RoomSignalHandler<Identity> = NonNullable<
  RoomRuntime<RoomState, RoomCommandPayload, Identity>['receive']
>;

export type RoomSignalListener = (payload: RoomCommandPayload) => void;
