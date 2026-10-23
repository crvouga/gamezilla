export type AnalyticsEvent = {
  readonly name: string;
  readonly version: number;
  readonly id: string;
  readonly occurredAtMs: number;
  readonly synthetic?: boolean;
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
};

export type ReportingWindow = {
  readonly fromMs: number;
  readonly untilMs: number;
};

/** Event time, half-open UTC windows and logical identity make replay and late
 * arrival reproducible. Conflicting copies fail closed instead of picking one. */
export function logicalEvents(
  events: readonly AnalyticsEvent[],
  window: ReportingWindow
): readonly AnalyticsEvent[] {
  if (
    !Number.isSafeInteger(window.fromMs) ||
    !Number.isSafeInteger(window.untilMs) ||
    window.fromMs < 0 ||
    window.untilMs <= window.fromMs
  )
    throw new Error('Invalid reporting window');
  const seen = new Map<string, AnalyticsEvent>();
  for (const event of events) {
    const key = JSON.stringify([event.name, event.version, event.id]);
    const previous = seen.get(key);
    if (previous !== undefined && canonical(previous) !== canonical(event))
      throw new Error('Conflicting logical event identity');
    seen.set(key, event);
  }
  return [...seen.values()]
    .filter(
      (event) =>
        event.synthetic === false &&
        event.occurredAtMs >= window.fromMs &&
        event.occurredAtMs < window.untilMs
    )
    .sort(
      (a, b) =>
        a.occurredAtMs - b.occurredAtMs || compare(canonical(a), canonical(b))
    );
}

export function activeSubjects(
  events: readonly AnalyticsEvent[],
  input: {
    readonly window: ReportingWindow;
    readonly meaningfulEventNames: readonly string[];
    readonly subjectAttributes: readonly string[];
    readonly erasedSubjectIds: ReadonlySet<string>;
  }
): number {
  const subjects = new Set<string>();
  for (const event of logicalEvents(events, input.window)) {
    if (!input.meaningfulEventNames.includes(event.name)) continue;
    for (const key of input.subjectAttributes) {
      const subject = event.attributes[key];
      if (
        typeof subject === 'string' &&
        subject.length > 0 &&
        !input.erasedSubjectIds.has(subject)
      )
        subjects.add(subject);
    }
  }
  return subjects.size;
}

function canonical(event: AnalyticsEvent): string {
  return JSON.stringify([
    event.name,
    event.version,
    event.id,
    event.occurredAtMs,
    event.synthetic,
    Object.keys(event.attributes)
      .sort()
      .map((key) => [key, event.attributes[key]]),
  ]);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
