import type { ResolvedIdentity } from './identity-resolver';
import type { NarrateSpan } from './narrate';
import type { ActivityTrace, PersonAccount, PlaceFit } from './person-types';
import { placeFit, recordedDeviceTimeZone, recordedPlace } from './place';

export type PlaceSelection = {
  readonly accounts: readonly PersonAccount[];
  /** Connection place of the shown accounts' activity. */
  readonly connection?: string;
  readonly deviceZone?: string;
  /** False when a place was asked and no account's activity recorded it. */
  readonly placeMatched: boolean;
  /** Traces of the accounts that stay. */
  readonly traces: readonly ActivityTrace[];
};

type Reading = {
  readonly fit: 0 | 1 | 2;
  readonly place?: string;
  readonly userId: string;
};

/**
 * Which accounts stay once a place is asked. Every trace an account was
 * seen on counts, not only the failing ones. A place that no account's
 * activity recorded keeps everyone and says so, so a connection that
 * appears elsewhere than the clock never hides the person.
 */
export function selectByPlace(
  traces: readonly ActivityTrace[],
  people: readonly ResolvedIdentity[],
  asked: string | undefined
): PlaceSelection {
  const want = asked?.trim() ?? '';
  const readings = people.map((person) => read(traces, person.userId, want));
  const best = Math.max(0, ...readings.map((reading) => reading.fit));
  const placeMatched = want.length === 0 || best > 0;
  const keeps = new Set(
    readings
      .filter(
        (reading) => want.length === 0 || best === 0 || reading.fit === best
      )
      .map((reading) => reading.userId)
  );
  const kept = traces.filter((item) =>
    item.accounts.some((userId) => keeps.has(userId))
  );
  const accounts = people.map((person, index) =>
    describe(person, readings[index], {
      asked: want,
      shown: keeps.has(person.userId),
      traces: traces.filter((item) => item.accounts.includes(person.userId))
        .length,
    })
  );
  const connection = firstRecorded(kept, recordedPlace);
  const deviceZone = firstRecorded(kept, recordedDeviceTimeZone);
  return {
    accounts,
    placeMatched,
    traces: kept,
    ...(connection === undefined ? {} : { connection }),
    ...(deviceZone === undefined ? {} : { deviceZone }),
  };
}

function read(
  traces: readonly ActivityTrace[],
  userId: string,
  asked: string
): Reading {
  let fit: 0 | 1 | 2 = 0;
  let place: string | undefined;
  for (const item of traces) {
    if (!item.accounts.includes(userId)) continue;
    for (const span of item.trace.spans) {
      const recorded = recordedPlace(span.attributes);
      if (recorded === undefined) continue;
      place ??= recorded;
      const here = asked.length === 0 ? 0 : placeFit(asked, recorded);
      if (here > fit) {
        fit = here;
        place = recorded;
      }
    }
  }
  return { userId, fit, ...(place === undefined ? {} : { place }) };
}

function describe(
  person: ResolvedIdentity,
  reading: Reading | undefined,
  context: {
    readonly asked: string;
    readonly shown: boolean;
    readonly traces: number;
  }
): PersonAccount {
  const place = placeOf(reading, context.asked);
  return {
    userId: person.userId,
    matchedAs: person.matchedAs,
    place,
    shown: context.shown,
    traces: context.traces,
    reason: reasonFor(place, reading?.place, context),
    ...(reading?.place === undefined ? {} : { recordedPlace: reading.place }),
  };
}

function placeOf(reading: Reading | undefined, asked: string): PlaceFit {
  if (asked.length === 0) return 'not asked';
  if (reading?.place === undefined) return 'unrecorded';
  if (reading.fit === 2) return 'city';
  return reading.fit === 1 ? 'region' : 'none';
}

function reasonFor(
  place: PlaceFit,
  recorded: string | undefined,
  context: { readonly asked: string; readonly shown: boolean }
): string {
  const where = recorded ?? 'no place';
  if (place === 'not asked') return 'no place asked';
  if (place === 'city')
    return `connection city matched ${context.asked}: ${where}`;
  if (place === 'region')
    return `connection region or country matched ${context.asked}: ${where}`;
  if (place === 'unrecorded') return 'no connection place was recorded';
  return context.shown
    ? `connection appeared at ${where}, not ${context.asked}; no account matched, all kept`
    : `connection appeared at ${where}, not ${context.asked}`;
}

function firstRecorded(
  traces: readonly ActivityTrace[],
  readValue: (attributes: NarrateSpan['attributes']) => string | undefined
): string | undefined {
  for (const item of traces) {
    for (const span of item.trace.spans) {
      const value = readValue(span.attributes);
      if (value !== undefined) return value;
    }
  }
  return undefined;
}
