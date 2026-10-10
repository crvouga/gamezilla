import { replayDecision } from '@libs/synthetic-population-shared/decision-replay';
import type { EventRecord } from './records';
import { jsonValue } from './records';

export function replaySyntheticPopulationDecisions(
  events: readonly EventRecord[]
) {
  return events
    .filter((event) => event.event === 'DecisionSelected')
    .map((event) => {
      try {
        const context = jsonValue(event.context) as { replay?: unknown };
        const replay =
          typeof context?.replay === 'string'
            ? (JSON.parse(context.replay) as unknown)
            : null;
        return {
          eventId: event.id,
          createdAt: event.created_at,
          version: event.application_version,
          result: replayDecision(replay),
        };
      } catch {
        return {
          eventId: event.id,
          createdAt: event.created_at,
          version: event.application_version,
          result: null,
        };
      }
    });
}
