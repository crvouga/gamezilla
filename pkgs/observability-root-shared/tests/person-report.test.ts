import { describe, expect, test } from 'bun:test';
import { parseLocalClock } from '@pkgs/observability-root-shared/local-clock';
import { findPersonTrouble } from '@pkgs/observability-root-shared/person-trouble';
import type { PersonData } from '@pkgs/observability-root-shared/person-types';
import {
  ADA,
  ADA_ID,
  ASKED_MS,
  adaEvening,
  BOB,
  bobOnAdasDevice,
  directoryOf,
  MINUTE,
  NOW_MS,
} from './person-scenario';
import type { FixtureSpan } from './trace-fixtures';
import { storeOf, traceIdOf } from './trace-fixtures';

const NAME = 'Ada Lovelace';

async function ask(
  spans: readonly FixtureSpan[],
  extra: {
    readonly all?: boolean;
    readonly at?: string;
    readonly place?: string;
    readonly rowCap?: number;
    readonly slowMs?: number;
    readonly sourceFlag?: string;
    readonly windowMs?: number;
  } = {}
) {
  const report = await findPersonTrouble(
    storeOf(spans),
    directoryOf(NAME, [ADA_ID]),
    { name: NAME, at: extra.at ?? '7pm MST', nowMs: NOW_MS, ...extra }
  );
  const data = report.data;
  if (data === undefined) throw new Error('the report has no structure');
  return { report, data };
}

function rowKinds(data: PersonData): string[] {
  return data.timeline.rows.flatMap((row) =>
    row.kind === 'elided' ? [] : [row.kind]
  );
}

describe('an identity pivot joins what the account did without its user id', () => {
  // regression: obs-person-misses-activity-without-user-id
  test('a crash before sign-in joins through the shared device and session', async () => {
    const { data, report } = await ask([...adaEvening(), ...bobOnAdasDevice()]);
    const joined = data.traces.find((trace) => trace.traceId === traceIdOf(1));
    expect(joined?.via).toBe('session');
    expect(report.text).toContain('Network request failed');
    expect(data.problems.map((problem) => problem.message)).toContain(
      'Network request failed'
    );
  });

  test('another account on the same device is left out and counted', async () => {
    const { data, report } = await ask([...adaEvening(), ...bobOnAdasDevice()]);
    expect(data.traces.map((trace) => trace.traceId)).not.toContain(
      traceIdOf(20)
    );
    expect(report.text).not.toContain('bob only');
    expect(data.notes.join('\n')).toContain(
      '1 traces on the same session or device belong to other accounts'
    );
    expect(data.truncations).toEqual([]);
    expect(JSON.stringify(data)).not.toContain(BOB);
  });

  test('a trace found by user id and by device appears once', async () => {
    const { data } = await ask(adaEvening());
    const ids = data.traces.map((trace) => trace.traceId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('the report leads with problems and then tells the evening', () => {
  test('problems are ranked crash, failure, rejection and carry drill-down commands', async () => {
    const { data, report } = await ask(adaEvening(), { sourceFlag: 'prod' });
    expect(data.problems.map((problem) => problem.severity)).toEqual([
      'crash',
      'failure',
      'rejection',
    ]);
    const first = data.problems[0];
    expect(first?.drill.span).toBe(
      `bun obs span ${traceIdOf(1)} ${first?.spanId} --source prod`
    );
    expect(first?.drill.trace).toBe(
      `bun obs trace ${traceIdOf(1)} --source prod`
    );
    expect(report.text.indexOf('PROBLEMS (3')).toBeLessThan(
      report.text.indexOf('TIMELINE')
    );
    expect(report.sawTrouble).toBe(true);
    expect(report.traceId).toBe(traceIdOf(1));
  });

  test('the timeline shows what the person did and what the system did for them', async () => {
    const { data, report } = await ask(adaEvening());
    expect(new Set(rowKinds(data))).toEqual(
      new Set([
        'error',
        'route',
        'interaction',
        'request',
        'mutation',
        'rejection',
        'room',
        'slow',
      ])
    );
    expect(report.text).toContain('route change window:history');
    expect(report.text).toContain('click SignInButton -> request');
    expect(report.text).toContain('GET /api/profile -> 200');
    expect(report.text).toContain('POST /api/mutations -> 500');
    expect(report.text).toContain('mutation profile.rename mut-1 applied');
    expect(report.text).toContain('mutation mut-2 REJECTED (NOT_FOUND)');
    expect(report.text).toContain('room message chess:abc accepted 120B');
    expect(report.text).toContain('SLOW outbox.drain');
  });

  test('times read on the person clock and in UTC', async () => {
    const { data, report } = await ask(adaEvening());
    expect(report.text).toContain('18:55:00 MST  01:55:00Z');
    expect(report.text).toContain('19:00:00 MST  02:00:00Z');
    const rejection = data.timeline.rows.find(
      (row) => row.kind === 'rejection'
    );
    expect(rejection).toMatchObject({
      atUtc: '2026-10-21T02:00:00.000Z',
      atLocal: '2026-10-20T19:00:00-07:00',
    });
  });

  test('database children are noise in the timeline but summed per trace', async () => {
    const { data, report } = await ask(adaEvening());
    expect(report.text).not.toContain('db.query');
    const request = data.traces.find((trace) => trace.traceId === traceIdOf(3));
    expect(request).toMatchObject({ spanCount: 3, dbQueries: 2, dbMs: 60 });
  });

  test('the header names account, window, counts, builds, devices, sessions and place', async () => {
    const { data, report } = await ask(adaEvening(), {
      place: 'Gilbert, Arizona',
    });
    expect(data.summary).toMatchObject({
      traces: 8,
      requests: 2,
      mutations: 2,
      rejected: 1,
      builds: ['abc1234'],
      devices: ['device-1'],
      sessions: ['session-1'],
      connection: 'Gilbert, Arizona, US',
      deviceClock: 'America/Phoenix',
    });
    expect(report.text).toContain(`person: ${NAME} -> user.id ${ADA}`);
    expect(report.text).toContain(
      'utc-range: 2026-10-21T01:45:00.000Z .. 2026-10-21T02:15:00.000Z'
    );
    expect(report.text).toContain(
      'summary: 8 traces, 2 requests, 3 errors, 2 mutations (1 rejected)'
    );
    expect(report.text).toContain('builds: abc1234');
    expect(report.text).toContain('place: matched Gilbert, Arizona');
  });

  test('the mutation name is used when recorded and the id stands alone when absent', async () => {
    const { report } = await ask(adaEvening());
    expect(report.text).toContain('mutation profile.rename mut-1');
    expect(report.text).toContain('mutation mut-2 REJECTED');
    expect(report.text).not.toContain('mutation undefined');
  });

  test('a slow span needs the configured threshold to earn a row', async () => {
    const strict = await ask(adaEvening(), { slowMs: 3_000 });
    expect(strict.report.text).not.toContain('SLOW outbox.drain');
    const eager = await ask(adaEvening(), { slowMs: 100 });
    expect(eager.report.text).toContain('SLOW outbox.drain');
  });
});

describe('the timeline stays readable', () => {
  const health = (index: number): FixtureSpan => ({
    trace: 100 + index,
    atMs: ASKED_MS + 6 * MINUTE + index * 1000,
    name: 'http.server.request',
    attributes: {
      'user.id': ADA,
      'http.request.method': 'GET',
      'http.route': '/api/health',
      'http.response.status_code': 200,
    },
  });

  test('identical consecutive rows collapse into one with a repeat count', async () => {
    const { data, report } = await ask([...[0, 1, 2, 3, 4].map(health)]);
    const rows = data.timeline.rows.filter((row) => row.kind === 'request');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ repeat: 5 });
    expect(report.text).toContain('GET /api/health -> 200');
    expect(report.text).toContain('(x5, until 02:06:04Z)');
  });

  test('a long timeline is capped, says how many rows were elided and how to widen', async () => {
    const { data, report } = await ask(adaEvening(), { rowCap: 4 });
    expect(data.timeline.elided).toBe(data.timeline.total - 4);
    expect(report.text).toContain(`${data.timeline.elided} rows elided`);
    expect(report.text).toContain('--window 2h');
    expect(report.text).toContain('--all');
    expect(report.text).toContain('Network request failed');
    expect(report.text).toContain('POST /api/mutations -> 500');
  });

  test('--all prints every row', async () => {
    const { data } = await ask(adaEvening(), { rowCap: 4, all: true });
    expect(data.timeline.elided).toBe(0);
  });

  test('a day boundary inside the window puts the date on every time', async () => {
    const { report } = await ask(
      [
        {
          trace: 1,
          atMs: Date.parse('2026-10-20T06:59:00.000Z'),
          name: 'route.change',
          attributes: { 'user.id': ADA },
        },
      ],
      { at: '12am MST', windowMs: 4 * 60 * MINUTE }
    );
    expect(report.text).toContain('10-19 23:59:00 MST  10-20 06:59:00Z');
  });
});

describe('activity without an error is still reported', () => {
  test('it says no error was recorded and still shows the timeline', async () => {
    const quiet = adaEvening().filter((span) => span.status !== 'error');
    const { report, data } = await ask(
      quiet.filter((span) => span.name !== 'client.error')
    );
    expect(report.code).toBe(0);
    expect(report.sawTrouble).toBe(false);
    expect(data.status).toBe('activity');
    expect(report.text).toContain(
      'No error was recorded; 1 requests, 1 mutations (0 rejected)'
    );
    expect(report.text).toContain('TIMELINE');
    expect(report.text).toContain('GET /api/profile -> 200');
  });

  // regression: obs-person-active-reported-as-nothing
  test('an active person with no error span is not told nothing happened', async () => {
    const { report } = await ask([
      {
        trace: 1,
        atMs: ASKED_MS,
        name: 'http.server.request',
        attributes: { 'user.id': ADA, 'http.route': '/api/profile' },
      },
    ]);
    expect(report.code).toBe(0);
    expect(report.text).not.toContain('Nothing happened');
    expect(report.text).toContain('No error was recorded');
  });
});

describe('a window with nothing in it looks outward', () => {
  const earlier = (hours: number): FixtureSpan => ({
    trace: 200,
    atMs: ASKED_MS - hours * 60 * MINUTE,
    name: 'route.change',
    attributes: { 'user.id': ADA },
  });
  const later = (minutes: number): FixtureSpan => ({
    trace: 201,
    atMs: ASKED_MS + minutes * MINUTE,
    name: 'route.change',
    attributes: { 'user.id': ADA },
  });

  test('it reports the last and the next time the account was seen, with commands to re-run', async () => {
    const { report, data } = await ask([earlier(3), later(45)]);
    expect(report.code).toBe(1);
    expect(data.status).toBe('quiet');
    expect(report.text).toContain(
      'Nothing happened for Ada Lovelace at that time.'
    );
    expect(report.text).toContain(
      'last seen: 2026-10-20 16:00:00 MST / 2026-10-20 23:00:00Z (3h before the asked time)'
    );
    expect(report.text).toContain(
      'next seen: 2026-10-20 19:45:00 MST / 2026-10-21 02:45:00Z (45m after the asked time)'
    );
    expect(data.seen?.last?.rerun).toContain('--at "2026-10-20 16:00 MST"');
  });

  test('the re-run command lands on the activity it points at', async () => {
    const spans = [earlier(3)];
    const { data } = await ask(spans);
    const rerun = data.seen?.last?.rerun ?? '';
    const at = /--at "([^"]+)"/.exec(rerun)?.[1] ?? '';
    expect(parseLocalClock(at, NOW_MS)?.instantMs).toBe(
      ASKED_MS - 3 * 60 * MINUTE
    );
    const again = await ask(spans, { at });
    expect(again.data.status).toBe('activity');
  });

  test('an account with no telemetry at all is told apart from an unknown name', async () => {
    const found = await ask([]);
    expect(found.data.status).toBe('quiet');
    expect(found.report.text).toContain(
      'The account exists but has no telemetry within 7d'
    );
    expect(found.report.text).toContain(
      'Nothing happened for Ada Lovelace at that time.'
    );
    const unknown = await findPersonTrouble(
      storeOf([]),
      directoryOf(NAME, []),
      { name: NAME, at: '7pm MST', nowMs: NOW_MS }
    );
    expect(unknown.data?.status).toBe('account-not-found');
    expect(unknown.text).toContain('No account is named "Ada Lovelace"');
  });
});

describe('several people who share a name', () => {
  const grace = { userId: 'user-grace', matchedAs: 'name' } as const;
  const people = [ADA_ID, grace];
  const spans: FixtureSpan[] = [
    {
      trace: 1,
      atMs: ASKED_MS,
      name: 'http.server.request',
      attributes: {
        'user.id': ADA,
        'app.client.city': 'Gilbert',
        'app.client.region': 'Arizona',
      },
    },
    {
      trace: 2,
      atMs: ASKED_MS,
      name: 'http.server.request',
      attributes: {
        'user.id': 'user-grace',
        'app.client.city': 'Reno',
        'app.client.region': 'Nevada',
      },
    },
  ];

  test('a place chosen from ordinary requests, not only errors, says who matched and why', async () => {
    const report = await findPersonTrouble(
      storeOf(spans),
      directoryOf(NAME, people),
      {
        name: NAME,
        at: '7pm MST',
        place: 'Reno',
        nowMs: NOW_MS,
      }
    );
    expect(report.userIds).toEqual(['user-grace']);
    expect(report.text).toContain(
      'people: 2 share this name; 1 match this place and time'
    );
    expect(report.text).toContain(
      `user.id ${ADA}: left out; connection appeared at Gilbert, Arizona, not Reno`
    );
    expect(report.text).toContain(
      'user.id user-grace: shown; connection city matched Reno'
    );
  });

  test('without a place every account is kept and listed', async () => {
    const report = await findPersonTrouble(
      storeOf(spans),
      directoryOf(NAME, people),
      {
        name: NAME,
        at: '7pm MST',
        nowMs: NOW_MS,
      }
    );
    expect(report.userIds).toEqual([ADA, 'user-grace']);
    expect(report.data?.accounts.every((account) => account.shown)).toBe(true);
  });
});

describe('the structured report', () => {
  test('--json carries the same facts in a stable, typed shape', async () => {
    const { data, report } = await ask(adaEvening(), { sourceFlag: 'prod' });
    const parsed = JSON.parse(JSON.stringify(data)) as PersonData;
    expect(parsed.schema).toBe('obs.person/v1');
    expect(Object.keys(parsed).sort()).toEqual(
      [
        'accounts',
        'clock',
        'next',
        'notes',
        'problems',
        'question',
        'schema',
        'source',
        'status',
        'summary',
        'timeline',
        'traces',
        'truncations',
        'window',
      ].sort()
    );
    expect(parsed.clock).toMatchObject({
      zone: 'America/Phoenix',
      zoneLabel: 'MST',
      offsetMinutes: -420,
      instantUtc: '2026-10-21T02:00:00.000Z',
    });
    expect(parsed.problems).toHaveLength(parsed.summary?.errors ?? -1);
    expect(parsed.next[0]).toBe(report.data?.problems[0]?.drill.span);
  });
});

describe('searches that stop early say so', () => {
  // regression: obs-tempo-search-truncates-silently
  test('more traces than the limit is announced in the text and in the structure', async () => {
    const many: FixtureSpan[] = Array.from({ length: 250 }, (_, index) => ({
      trace: 1_000 + index,
      atMs: ASKED_MS - 5 * MINUTE + index * 100,
      name: 'http.server.request',
      attributes: { 'user.id': ADA, 'http.route': '/api/x' },
    }));
    const { data, report } = await ask(many);
    expect(data.traces).toHaveLength(200);
    expect(data.truncations.join('\n')).toContain('stopped at 200 traces');
    expect(report.text).toContain(
      'WARNING truncated: user.id = user-ada: stopped at 200 traces'
    );
    const all = await ask(many, { all: true });
    expect(all.data.traces).toHaveLength(250);
    expect(all.data.truncations).toEqual([]);
  });

  test('an unusable clock is usage, not a search', async () => {
    const report = await findPersonTrouble(
      storeOf([]),
      directoryOf(NAME, [ADA_ID]),
      {
        name: NAME,
        at: '7pm',
        nowMs: NOW_MS,
      }
    );
    expect(report.code).toBe(2);
    expect(report.data?.status).toBe('invalid-clock');
    expect(report.text).toContain('needs a zone');
  });
});
