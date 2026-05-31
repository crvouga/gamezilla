import { asKeyword, type Keyword } from '@pkgs/keyword';
import type { PubSub } from '@pkgs/pub-sub/interface';
import type { Patch, PatchRejectionReason } from '../interface';
import { PatchDbTransportRejectedError } from '../transport/transport-rejected-error';

/** Topic for server push attempts (dev widget / diagnostics). */
export const SERVER_WRITE_TOPIC: Keyword = asKeyword(
  'patch-db.bus/server-write'
);

export type ServerWritePatchSummary = {
  readonly patchId: string;
  readonly entityType: string;
  readonly entityId: string;
};

export type ServerWriteOutcome =
  | 'accepted'
  | 'rejected'
  | 'transport_rejected'
  | 'error';

export type ServerWriteEvent = {
  readonly id: string;
  readonly at: string;
  readonly outcome: ServerWriteOutcome;
  readonly patches: readonly ServerWritePatchSummary[];
  readonly acceptedCount: number;
  readonly rejected: readonly PatchRejectionReason[];
  readonly httpStatus?: number;
  readonly errorMessage?: string;
};

const MAX_EVENTS = 100;

const ring: ServerWriteEvent[] = [];

export function recentServerWriteEvents(): readonly ServerWriteEvent[] {
  return ring;
}

function summarizePatches(chunk: readonly Patch[]): ServerWritePatchSummary[] {
  return chunk.map((p) => ({
    patchId: p.patchId,
    entityType: p.entityType,
    entityId: p.entityId,
  }));
}

function pushEvent(event: ServerWriteEvent): void {
  ring.unshift(event);
  if (ring.length > MAX_EVENTS) {
    ring.length = MAX_EVENTS;
  }
}

function newEventId(): string {
  return crypto.randomUUID();
}

export function publishServerWriteAccepted(
  pubSub: PubSub,
  chunk: readonly Patch[],
  acceptedCount: number,
  rejected: readonly PatchRejectionReason[]
): void {
  const outcome: ServerWriteOutcome =
    rejected.length > 0 ? 'rejected' : 'accepted';
  const event: ServerWriteEvent = {
    id: newEventId(),
    at: new Date().toISOString(),
    outcome,
    patches: summarizePatches(chunk),
    acceptedCount,
    rejected,
  };
  pushEvent(event);
  pubSub.publish(SERVER_WRITE_TOPIC, event);
}

export function publishServerWriteTransportRejected(
  pubSub: PubSub,
  chunk: readonly Patch[],
  err: PatchDbTransportRejectedError
): void {
  const event: ServerWriteEvent = {
    id: newEventId(),
    at: new Date().toISOString(),
    outcome: 'transport_rejected',
    patches: summarizePatches(chunk),
    acceptedCount: 0,
    rejected: [],
    httpStatus: err.status,
    errorMessage: err.message,
  };
  pushEvent(event);
  pubSub.publish(SERVER_WRITE_TOPIC, event);
}

export function publishServerWriteError(
  pubSub: PubSub,
  chunk: readonly Patch[],
  err: unknown
): void {
  const httpStatus =
    err instanceof PatchDbTransportRejectedError ? err.status : undefined;
  const errorMessage = err instanceof Error ? err.message : String(err);
  const event: ServerWriteEvent = {
    id: newEventId(),
    at: new Date().toISOString(),
    outcome: 'error',
    patches: summarizePatches(chunk),
    acceptedCount: 0,
    rejected: [],
    ...(httpStatus !== undefined ? { httpStatus } : {}),
    errorMessage,
  };
  pushEvent(event);
  pubSub.publish(SERVER_WRITE_TOPIC, event);
}

export function clearServerWriteEventRing(): void {
  ring.length = 0;
}
