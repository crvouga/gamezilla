import type {
  RoomActor,
  RoomCommand,
  RoomCommandPayload,
  RoomError,
} from './types';

/**
 * Transient intents share the authenticated room connection. They are never
 * logged, deduplicated in storage, predicted by room's event fold, or queued
 * offline. A consumer supplies bounded sequence/ack state in its typed payload.
 */
export type RoomSignalHandler<Identity> = (
  command: RoomCommand,
  identity: Identity,
  actor: RoomActor
) => Promise<RoomError | null> | RoomError | null;

export type RoomSignalListener = (payload: RoomCommandPayload) => void;
