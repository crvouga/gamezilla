import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import type { LogEntry, RoomEvent, RoomModule } from './types';

/**
 * What a connection receives in place of a private entry it may not read:
 * the same sequence number, actor and time, and no content. Every log stays
 * contiguous while nobody's copy holds what its reader may not know.
 */
export const RoomEventWithheld = createMessageNamespace('room-private')(
  'withheld',
  (value): value is Record<string, never> =>
    isPlainRecord(value) && Object.keys(value).length === 0
);

const WITHHELD = RoomEventWithheld({});

/** The part of a module that decides who reads its events. */
export type RoomAudience<E extends RoomEvent> = {
  readonly audience?: RoomModule<never, never, E>['audience'];
};

/** Whether `viewer` may read `event`: a public event, or one addressed to them. */
export function readableBy<E extends RoomEvent>(
  module: RoomAudience<E>,
  event: E,
  viewer: string
): boolean {
  const audience = module.audience?.(event) ?? null;
  return audience === null || audience.includes(viewer);
}

/** Whether any entry is private, so one frame cannot serve every reader. */
export function hasPrivateEntries<E extends RoomEvent>(
  module: RoomAudience<E>,
  entries: readonly LogEntry<E>[]
): boolean {
  if (module.audience === undefined) return false;
  return entries.some((entry) => module.audience?.(entry.event) != null);
}

/**
 * `entries` as `viewer` receives them: each private event outside its
 * audience withheld. The same array when nothing is withheld.
 */
export function entriesFor<E extends RoomEvent>(
  module: RoomAudience<E>,
  entries: readonly LogEntry<E>[],
  viewer: string
): readonly LogEntry<E>[] {
  if (!hasPrivateEntries(module, entries)) return entries;
  return entries.map((entry) =>
    readableBy(module, entry.event, viewer)
      ? entry
      : { ...entry, event: WITHHELD as E }
  );
}
