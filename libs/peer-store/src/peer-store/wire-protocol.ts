import type { LogEntry } from '../peer-store-persistence/log-entry'
import type { Event, StoreError } from '../protocol/message-types'
import type { Command, Snapshot } from './peer-store-types'

export type OptimisticEvent = Event & { readonly _commandId: string };

export type WireMessage =
  | { kind: 'propose'; command: Command }
  | { kind: 'accepted'; commandId: string; entries: LogEntry[] }
  | { kind: 'rejected'; commandId: string; error: StoreError }
  | { kind: 'heartbeat'; from: string; latestSeq: number }
  | { kind: 'sync-request'; from: string; sinceSeq: number }
  | {
      kind: 'sync-response';
      to: string;
      snapshot: Snapshot;
      baseSeq: number;
      /** Log rows with seq <= baseSeq (materialized in `snapshot`). */
      prefix: LogEntry[];
      /** Log rows with seq > baseSeq. */
      entries: LogEntry[];
    };

export type SystemCommandEvalResult =
  | { ok: true; entries: LogEntry[] }
  | { ok: false; error: StoreError };
