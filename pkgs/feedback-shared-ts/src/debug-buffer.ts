import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { DebugEvent, DebugEventKind } from './types';

/** Debug info covers the last 5 minutes. */
export const DEBUG_WINDOW_MS = 5 * 60_000;
export const MAX_BUFFERED_EVENTS = 300;
export const MAX_EVENT_TEXT = 200;
const MAX_TROUBLE_TEXT = 4000;

export type DebugBuffer = {
  readonly record: (kind: DebugEventKind, text: string) => void;
  /** Brings back events kept from the app's last visit. */
  readonly restore: (events: readonly DebugEvent[]) => void;
  /** The events of the last 5 minutes, oldest first. */
  readonly snapshot: () => readonly DebugEvent[];
};

/**
 * Always-on trail of what happened in the app. Bounded by age and by count,
 * so keeping it costs the same after a second as after a day.
 */
export function createDebugBuffer(options: {
  readonly clock: Clock;
}): DebugBuffer {
  let events: { at: number; kind: DebugEventKind; text: string }[] = [];
  const prune = (): void => {
    const oldest = options.clock.now() - DEBUG_WINDOW_MS;
    events = events.filter((event) => event.at >= oldest);
    if (events.length > MAX_BUFFERED_EVENTS)
      events = events.slice(events.length - MAX_BUFFERED_EVENTS);
  };
  return {
    record(kind, text) {
      events.push({
        at: options.clock.now(),
        kind,
        text: text.slice(
          0,
          kind === 'trouble' ? MAX_TROUBLE_TEXT : MAX_EVENT_TEXT
        ),
      });
      prune();
    },
    restore(kept) {
      const known = kept.flatMap((event) => {
        const at = Date.parse(event.at);
        return Number.isNaN(at) ? [] : [{ ...event, at }];
      });
      events = [...known, ...events].sort((a, b) => a.at - b.at);
      prune();
    },
    snapshot() {
      prune();
      return events.map((event) => ({
        at: new Date(event.at).toISOString(),
        kind: event.kind,
        text: event.text,
      }));
    },
  };
}
