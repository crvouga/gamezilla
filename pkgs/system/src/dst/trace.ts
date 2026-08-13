export type TraceKind =
  | 'build'
  | 'call'
  | 'reply'
  | 'deliver'
  | 'drop'
  | 'revive'
  | 'fault'
  | 'log';

export type TraceEvent = {
  readonly seq: number;
  readonly kind: TraceKind;
  readonly at: string;
  readonly detail?: string;
};

export function createTrace() {
  const events: TraceEvent[] = [];
  let seq = 0;

  return {
    push(kind: TraceKind, at: string, detail?: string) {
      const event: TraceEvent =
        detail === undefined
          ? { seq: seq++, kind, at }
          : { seq: seq++, kind, at, detail };
      events.push(event);
    },
    events: () => events.slice(),
    toString() {
      return events
        .map((e) => {
          const d = e.detail ? ` ${e.detail}` : '';
          return `${e.seq}:${e.kind}@${e.at}${d}`;
        })
        .join('\n');
    },
  };
}

export type Trace = ReturnType<typeof createTrace>;
