import {
  gameCompletedEvent,
  gameStartedEvent,
} from '@libs/game-matchmaking-shared-ts/telemetry';
import { puzzleAttemptedEvent } from '@libs/game-puzzle-shared-ts/telemetry';
import {
  playerJoinedEvent,
  spaceCreatedEvent,
} from '@libs/spaces-shared-ts/telemetry';
import {
  type AnalyticsEvent,
  activeSubjects,
  logicalEvents,
  type ReportingWindow,
} from '@pkgs/observability-root-shared-ts/event-analytics';

const DAY_MS = 86_400_000;
export const BUSINESS_USAGE_V1 = {
  version: 1,
  meaningfulEventNames: [
    spaceCreatedEvent.contract.name,
    playerJoinedEvent.contract.name,
    puzzleAttemptedEvent.contract.name,
    gameStartedEvent.contract.name,
  ],
  subjectAttributes: [
    'subject.id',
    'participant.white.id',
    'participant.black.id',
  ],
  windows: { dailyDays: 1, weeklyDays: 7, monthlyDays: 30 },
} as const;

/** DAU/WAU/MAU end at midnight following the requested UTC reporting day.
 * Unknown/synthetic provenance and erased subjects never enter these counts. */
export function businessUsage(
  events: readonly AnalyticsEvent[],
  input: {
    readonly reportingDayMs: number;
    readonly erasedSubjectIds: ReadonlySet<string>;
    /** Trusted account classification, including bots in mixed-player games. */
    readonly syntheticSubjectIds: ReadonlySet<string>;
  }
) {
  const dayStart = Math.floor(input.reportingDayMs / DAY_MS) * DAY_MS;
  const untilMs = dayStart + DAY_MS;
  const versioned = events.filter(
    (event) => event.version === BUSINESS_USAGE_V1.version
  );
  const count = (days: number) =>
    activeSubjects(versioned, {
      window: { fromMs: Math.max(0, untilMs - days * DAY_MS), untilMs },
      meaningfulEventNames: BUSINESS_USAGE_V1.meaningfulEventNames,
      subjectAttributes: BUSINESS_USAGE_V1.subjectAttributes,
      erasedSubjectIds: new Set([
        ...input.erasedSubjectIds,
        ...input.syntheticSubjectIds,
      ]),
    });
  return { definitionVersion: 1, dau: count(1), wau: count(7), mau: count(30) };
}

/** Completion is measured on the started-game cohort, as of the window end,
 * so completions of games from another cohort cannot inflate its numerator. */
export function gameCompletion(
  events: readonly AnalyticsEvent[],
  window: ReportingWindow
) {
  const versioned = events.filter((event) => event.version === 1);
  const started = new Set(
    logicalEvents(versioned, window)
      .filter((event) => event.name === gameStartedEvent.contract.name)
      .map((event) => event.attributes['game.id'])
      .filter((id): id is string => typeof id === 'string')
  );
  const completed = new Set(
    logicalEvents(versioned, { fromMs: 0, untilMs: window.untilMs })
      .filter(
        (event) =>
          event.name === gameCompletedEvent.contract.name &&
          started.has(String(event.attributes['game.id']))
      )
      .map((event) => event.attributes['game.id'])
  );
  return {
    started: started.size,
    completed: completed.size,
    rate: started.size === 0 ? null : completed.size / started.size,
  };
}
