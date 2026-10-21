import { expect, test } from 'bun:test';
import { findPersonTrouble } from '@pkgs/observability-root-shared/person-trouble';
import type { PersonData } from '@pkgs/observability-root-shared/person-types';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import {
  ADA,
  ADA_ID,
  ASKED_MS,
  BOB,
  directoryOf,
  MINUTE,
  NOW_MS,
} from './person-scenario';
import type { FixtureSpan } from './trace-fixtures';
import { storeOf, traceIdOf } from './trace-fixtures';

const NAME = 'Ada Lovelace';
const HALF_WINDOW = 15 * MINUTE;

type Tag = 'user' | 'session' | 'device' | 'other' | 'none';
type Kind =
  | 'request'
  | 'route'
  | 'mutation'
  | 'error'
  | 'quiet'
  | 'db'
  | 'slow';

type Drawn = {
  readonly kind: Kind;
  readonly offsetMin: number;
  readonly tag: Tag;
  readonly trace: number;
};

const drawn = fc.record({
  trace: fc.integer({ min: 1, max: 10 }),
  offsetMin: fc.integer({ min: -40, max: 40 }),
  kind: fc.constantFrom<Kind>(
    'request',
    'route',
    'mutation',
    'error',
    'quiet',
    'db',
    'slow'
  ),
  tag: fc.constantFrom<Tag>('user', 'session', 'device', 'other', 'none'),
});

/** Every span of one trace carries that trace's tag, so ownership is a trace fact. */
function tagsPerTrace(draws: readonly Drawn[]): Map<number, Tag> {
  const tags = new Map<number, Tag>();
  for (const draw of draws)
    if (!tags.has(draw.trace)) tags.set(draw.trace, draw.tag);
  return tags;
}

const TAG_ATTRIBUTES: Readonly<Record<Tag, Readonly<Record<string, string>>>> =
  {
    user: { 'user.id': ADA, 'session.id': 's1', 'app.device.id': 'd1' },
    session: { 'session.id': 's1' },
    device: { 'app.device.id': 'd1' },
    other: { 'user.id': BOB, 'app.device.id': 'd1' },
    none: {},
  };

function spansOf(draws: readonly Drawn[]): FixtureSpan[] {
  const tags = tagsPerTrace(draws);
  return draws.map((draw, index) => ({
    trace: draw.trace,
    spanId: (index + 1).toString(16).padStart(16, '0'),
    atMs: ASKED_MS + draw.offsetMin * MINUTE,
    name: nameOf(draw.kind),
    status: draw.kind === 'error' ? 'error' : 'ok',
    durationMs: draw.kind === 'slow' ? 2_000 : 5,
    attributes: {
      ...TAG_ATTRIBUTES[tags.get(draw.trace) ?? 'none'],
      ...(draw.kind === 'db' ? { 'db.system.name': 'postgresql' } : {}),
      ...(draw.kind === 'mutation' ? { 'app.mutation.id': `m-${index}` } : {}),
    },
  }));
}

function nameOf(kind: Kind): string {
  switch (kind) {
    case 'request':
      return 'http.server.request';
    case 'route':
      return 'route.change';
    case 'mutation':
      return 'mutation.replay';
    case 'error':
      return 'client.error';
    case 'db':
      return 'db.query';
    case 'slow':
      return 'outbox.drain';
    case 'quiet':
      return 'worker.fetch';
  }
}

async function report(spans: readonly FixtureSpan[], at = '7pm MST') {
  const result = await findPersonTrouble(
    storeOf(spans),
    directoryOf(NAME, [ADA_ID]),
    { name: NAME, at, nowMs: NOW_MS, all: true }
  );
  return result.data as PersonData;
}

function inWindow(draw: Drawn): boolean {
  return Math.abs(draw.offsetMin * MINUTE) <= HALF_WINDOW;
}

/** What the account owns: its own traces, and the shared session or device ones once it was active. */
function owned(draws: readonly Drawn[]): Set<number> {
  const tags = tagsPerTrace(draws);
  const active = draws.some((d) => inWindow(d) && tags.get(d.trace) === 'user');
  const allowed: Tag[] = active ? ['user', 'session', 'device'] : ['user'];
  return new Set(
    draws
      .filter(
        (d) => inWindow(d) && allowed.includes(tags.get(d.trace) ?? 'none')
      )
      .map((d) => d.trace)
  );
}

test('property: the timeline never goes backwards', async () => {
  await assertProperty(
    'timeline is time-ordered',
    fc.asyncProperty(fc.array(drawn, { maxLength: 40 }), async (draws) => {
      const data = await report(spansOf(draws));
      const times = data.timeline.rows.flatMap((row) =>
        row.kind === 'elided' ? [] : [Date.parse(row.atUtc)]
      );
      expect(times).toEqual([...times].sort((a, b) => a - b));
    })
  );
});

test('property: every error span of the person inside the window is a problem', async () => {
  await assertProperty(
    'problems cover every error span',
    fc.asyncProperty(fc.array(drawn, { maxLength: 40 }), async (draws) => {
      const data = await report(spansOf(draws));
      const mine = owned(draws);
      const spans = spansOf(draws);
      const expected = draws
        .map((draw, index) => ({ draw, span: spans[index] }))
        .filter(
          ({ draw }) =>
            draw.kind === 'error' && inWindow(draw) && mine.has(draw.trace)
        )
        .map(({ span }) => span?.spanId ?? '')
        .sort();
      expect(data.problems.map((problem) => problem.spanId).sort()).toEqual(
        expected
      );
    })
  );
});

test('property: pivoting never drops or duplicates a trace', async () => {
  await assertProperty(
    'pivot completeness',
    fc.asyncProperty(fc.array(drawn, { maxLength: 40 }), async (draws) => {
      const data = await report(spansOf(draws));
      const ids = data.traces.map((trace) => trace.traceId);
      expect(new Set(ids).size).toBe(ids.length);
      const expected = [...owned(draws)].map(traceIdOf).sort();
      expect([...ids].sort()).toEqual(data.status === 'quiet' ? [] : expected);
    })
  );
});

test('property: the zone used to ask for an instant never changes what is found', async () => {
  await assertProperty(
    'zone independence',
    fc.asyncProperty(fc.array(drawn, { maxLength: 30 }), async (draws) => {
      const spans = spansOf(draws);
      const asks = ['7pm MST', '6pm PST', '8pm MDT', '2am UTC'];
      const views = await Promise.all(asks.map((at) => report(spans, at)));
      const shape = (data: PersonData) => ({
        status: data.status,
        window: data.window,
        summary: data.summary,
        traces: data.traces,
        problems: data.problems.map((p) => [
          p.traceId,
          p.spanId,
          p.severity,
          p.message,
          p.atUtc,
        ]),
        rows: data.timeline.rows.map((row) =>
          row.kind === 'elided'
            ? row
            : [row.kind, row.atUtc, row.summary, row.traceId]
        ),
      });
      for (const view of views)
        expect(shape(view)).toEqual(shape(views[0] as PersonData));
    })
  );
});

test('property: a search that stops early always says so', async () => {
  await assertProperty(
    'truncation is announced',
    fc.asyncProperty(fc.integer({ min: 0, max: 260 }), async (count) => {
      const spans: FixtureSpan[] = Array.from(
        { length: count },
        (_, index) => ({
          trace: 5_000 + index,
          atMs: ASKED_MS - 10 * MINUTE + index * 50,
          name: 'route.change',
          attributes: { 'user.id': ADA },
        })
      );
      const result = await findPersonTrouble(
        storeOf(spans),
        directoryOf(NAME, [ADA_ID]),
        { name: NAME, at: '7pm MST', nowMs: NOW_MS }
      );
      const data = result.data as PersonData;
      expect(data.traces.length).toBe(Math.min(count, 200));
      if (count > 200) {
        expect(data.truncations.length).toBeGreaterThan(0);
        expect(result.text).toContain('WARNING truncated');
      } else {
        expect(data.truncations).toEqual([]);
      }
    })
  );
});
