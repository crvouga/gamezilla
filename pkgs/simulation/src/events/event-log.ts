import type {
  EventMatcher,
  SimulationEvent,
  SimulationEventKind,
} from './types';

export type EventLogListener = (event: SimulationEvent) => void;

export type CreateEventLogArgs = {
  readonly now: () => number;
};

/** Append-only event log with matcher hooks for crashOn / report export. */
export function createEventLog(args: CreateEventLogArgs) {
  const events: SimulationEvent[] = [];
  const listeners = new Set<EventLogListener>();
  let seq = 0;

  function append(
    partial: Omit<SimulationEvent, 'id' | 'atMs'> & {
      readonly atMs?: number;
    }
  ): SimulationEvent {
    seq += 1;
    const event: SimulationEvent = {
      id: `e-${String(seq).padStart(6, '0')}`,
      atMs: partial.atMs ?? args.now(),
      kind: partial.kind,
      ...(partial.nodeId !== undefined ? { nodeId: partial.nodeId } : {}),
      ...(partial.from !== undefined ? { from: partial.from } : {}),
      ...(partial.to !== undefined ? { to: partial.to } : {}),
      ...(partial.title !== undefined ? { title: partial.title } : {}),
      ...(partial.detail !== undefined ? { detail: partial.detail } : {}),
      ...(partial.status !== undefined ? { status: partial.status } : {}),
      ...(partial.meta !== undefined ? { meta: partial.meta } : {}),
    };
    events.push(event);
    for (const listener of [...listeners]) {
      listener(event);
    }
    return event;
  }

  function matches(event: SimulationEvent, matcher: EventMatcher): boolean {
    if (matcher.nodeId !== undefined && event.nodeId !== matcher.nodeId) {
      return false;
    }
    if (matcher.from !== undefined && event.from !== matcher.from) {
      return false;
    }
    if (matcher.to !== undefined && event.to !== matcher.to) {
      return false;
    }
    if (matcher.kind !== undefined) {
      const kinds: readonly SimulationEventKind[] =
        typeof matcher.kind === 'string' ? [matcher.kind] : matcher.kind;
      if (!kinds.includes(event.kind)) return false;
    }
    return true;
  }

  return {
    append,
    matches,
    snapshot: (): readonly SimulationEvent[] => [...events],
    subscribe(listener: EventLogListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type EventLog = ReturnType<typeof createEventLog>;
