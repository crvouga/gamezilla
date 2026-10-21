import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared-ts/message';
import type { LogEntry } from './types';

/** No personal identifier is carried by the cache-reset marker. */
export const RoomCacheInvalidated = createMessageNamespace('room-cache')(
  'invalidated',
  (value): value is Record<string, never> =>
    isPlainRecord(value) && Object.keys(value).length === 0
);

export function cacheWasInvalidated(entries: readonly LogEntry[]): boolean {
  return entries.some((entry) => RoomCacheInvalidated.is(entry.event));
}
