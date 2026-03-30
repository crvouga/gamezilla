import type { Unsubscribe } from '../../@shared/pub-sub/interface';
import type { PatchesDbRead, PatchesDbWrite } from '../interface';

/** Invalidation fan-out for sync (SSE, in-process, etc.). Same shape as `RemoteInvalidationSource` (impl-sync). */
export type PatchesDbTransportSubscriptions = {
  subscribe(callback: () => void): Unsubscribe;
};

/** Client-side transport port: remote read/write + invalidation stream. */
export type PatchDbClientTransport = PatchesDbRead &
  PatchesDbWrite &
  PatchesDbTransportSubscriptions;

/**
 * Authority-side sync port (no HTTP): merge known patches, read, write, and
 * invalidation fan-out for remote clients.
 */
export type PatchDbSyncHost = PatchesDbRead &
  PatchesDbWrite &
  PatchesDbTransportSubscriptions;
