// @io-wall-ok — reads the fixture objective file.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseOpenSlo } from '@pkgs/openslo-shared-ts/parse';

const FIXTURE = join(import.meta.dir, 'fixtures/note-delivery.openslo.yaml');

type Doc = Record<string, unknown>;

const source = (spec: Doc = {}) => ({
  metricSource: { type: 'product', spec: { event: 'note saved' }, ...spec },
});

const ratioSli = (name = 'delivered', spec: Doc = {}): Doc => ({
  apiVersion: 'openslo/v1',
  kind: 'SLI',
  metadata: { name },
  spec: {
    ratioMetric: { counter: true, good: source(), total: source() },
    ...spec,
  },
});

const thresholdSli = (name = 'latency'): Doc => ({
  apiVersion: 'openslo/v1',
  kind: 'SLI',
  metadata: { name },
  spec: { thresholdMetric: source() },
});

const slo = (spec: Doc = {}, name = 'delivery'): Doc => ({
  apiVersion: 'openslo/v1',
  kind: 'SLO',
  metadata: { name },
  spec: {
    service: 'sync-engine',
    indicatorRef: 'delivered',
    timeWindow: [{ duration: '28d', isRolling: true }],
    budgetingMethod: 'Occurrences',
    objectives: [{ displayName: 'most notes', target: 0.99 }],
    ...spec,
  },
});

/** JSON is YAML: one document per item, `---` between them. */
const yaml = (...docs: readonly Doc[]) =>
  docs.map((d) => JSON.stringify(d)).join('\n---\n');

const issuesOf = (...docs: readonly Doc[]): readonly string[] => {
  const parsed = parseOpenSlo(yaml(...docs));
  return parsed.ok ? [] : parsed.issues;
};

describe('a well-formed file', () => {
  test('reads every document of a multi-document file', () => {
    const parsed = parseOpenSlo(readFileSync(FIXTURE, 'utf8'));
    if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
    expect(parsed.doc.slis.map((s) => [s.name, s.metric.kind])).toEqual([
      ['note-delivered', 'ratio'],
      ['note-delivery-time', 'threshold'],
    ]);
    expect(parsed.doc.slos.map((s) => s.name)).toEqual([
      'note-delivery-success',
      'note-delivery-latency',
      'note-delivery-hourly',
    ]);
    const latency = parsed.doc.slos[1];
    expect(latency?.objectives.map((o) => [o.op, o.value, o.target])).toEqual([
      ['lt', 200, 0.95],
      ['lt', 500, 0.99],
    ]);
    expect(parsed.doc.slos[2]?.timeWindow.calendar).toEqual({
      startTime: '2026-01-05 00:00:00',
      timeZone: 'UTC',
    });
  });

  test('an inline indicator is an SLI of the file', () => {
    const inline = slo({
      indicatorRef: undefined,
      indicator: {
        metadata: { name: 'inline-delivered' },
        spec: ratioSli()['spec'],
      },
    });
    const parsed = parseOpenSlo(yaml(inline));
    if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
    expect(parsed.doc.slis.map((s) => [s.name, s.inline])).toEqual([
      ['inline-delivered', true],
    ]);
    expect(parsed.doc.slos[0]?.indicator).toBe('inline-delivered');
  });

  test('a top-level list of documents reads like a multi-document file', () => {
    const parsed = parseOpenSlo(JSON.stringify([ratioSli(), slo()]));
    expect(parsed.ok).toBe(true);
  });
});

const threshold = { indicatorRef: 'latency' };

const cases: readonly (readonly [string, readonly Doc[], string])[] = [
  [
    'an unknown indicatorRef',
    [ratioSli(), slo({ indicatorRef: 'nope' })],
    'SLO delivery: indicatorRef "nope" names no SLI in this file',
  ],
  [
    'a bad duration',
    [
      ratioSli(),
      slo({ timeWindow: [{ duration: '4 weeks', isRolling: true }] }),
    ],
    'duration "4 weeks" must be a positive whole number',
  ],
  [
    'a zero duration',
    [ratioSli(), slo({ timeWindow: [{ duration: '0d', isRolling: true }] })],
    'duration "0d"',
  ],
  [
    'a target above 1',
    [ratioSli(), slo({ objectives: [{ displayName: 'x', target: 1.5 }] })],
    'target must be a number in (0, 1], got 1.5',
  ],
  [
    'a zero target',
    [ratioSli(), slo({ objectives: [{ displayName: 'x', target: 0 }] })],
    'target must be a number in (0, 1], got 0',
  ],
  [
    'a targetPercent above 100',
    [
      ratioSli(),
      slo({ objectives: [{ displayName: 'x', targetPercent: 101 }] }),
    ],
    'targetPercent must be a number in (0, 100], got 101',
  ],
  [
    'both target and targetPercent',
    [
      ratioSli(),
      slo({
        objectives: [{ displayName: 'x', target: 0.9, targetPercent: 90 }],
      }),
    ],
    'needs exactly one of target and targetPercent',
  ],
  [
    'a duplicate SLI',
    [ratioSli(), ratioSli(), slo()],
    'SLI delivered is declared twice',
  ],
  [
    'a duplicate SLO',
    [ratioSli(), slo(), slo()],
    'SLO delivery is declared twice',
  ],
  [
    'a duplicate objective',
    [
      ratioSli(),
      slo({
        objectives: [
          { displayName: 'x', target: 0.9 },
          { displayName: 'x', target: 0.8 },
        ],
      }),
    ],
    'objective "x" is declared twice',
  ],
  [
    'a missing service',
    [ratioSli(), slo({ service: undefined })],
    'SLO delivery: service is missing',
  ],
  [
    'a missing metadata',
    [{ ...ratioSli(), metadata: undefined }],
    'document 1 (SLI): metadata is missing',
  ],
  [
    'a name not in kebab-case',
    [ratioSli('Delivered')],
    'metadata.name "Delivered" must be kebab-case',
  ],
  [
    'an unknown kind',
    [{ ...ratioSli(), kind: 'DataSource' }, ratioSli(), slo()],
    'document 1: kind "DataSource" is not supported (SLI, SLO, AlertPolicy, AlertCondition, AlertNotificationTarget)',
  ],
  [
    'another apiVersion',
    [{ ...ratioSli(), apiVersion: 'openslo/v2alpha' }],
    'apiVersion must be openslo/v1, got "openslo/v2alpha"',
  ],
  [
    'a metric source without a type',
    [
      ratioSli('delivered', {
        ratioMetric: {
          counter: true,
          good: source({ type: undefined }),
          total: source(),
        },
      }),
      slo(),
    ],
    'ratioMetric.good.metricSource: type is missing',
  ],
  [
    'a metric source with an empty spec',
    [
      ratioSli('delivered', {
        ratioMetric: {
          counter: true,
          good: source(),
          total: source({ spec: {} }),
        },
      }),
      slo(),
    ],
    'ratioMetric.total.metricSource: spec must be a non-empty mapping',
  ],
  [
    'both good and bad',
    [
      ratioSli('delivered', {
        ratioMetric: {
          counter: true,
          good: source(),
          bad: source(),
          total: source(),
        },
      }),
      slo(),
    ],
    'ratioMetric needs exactly one of good and bad',
  ],
  [
    'both ratio and threshold',
    [ratioSli('delivered', { thresholdMetric: source() }), slo()],
    'spec needs exactly one of ratioMetric and thresholdMetric',
  ],
  [
    'a threshold objective without op',
    [
      thresholdSli(),
      slo({
        ...threshold,
        objectives: [{ displayName: 'fast', value: 200, target: 0.95 }],
      }),
    ],
    'threshold SLI latency needs op and value on every objective',
  ],
  [
    'a ratio objective with op and value',
    [
      ratioSli(),
      slo({
        objectives: [{ displayName: 'x', op: 'lt', value: 1, target: 0.9 }],
      }),
    ],
    'ratio SLI delivered takes no op or value',
  ],
  [
    'an unknown op',
    [
      thresholdSli(),
      slo({
        ...threshold,
        objectives: [{ displayName: 'x', op: 'below', value: 1, target: 0.9 }],
      }),
    ],
    'op must be one of lt, lte, gt, gte, got "below"',
  ],
  [
    'Timeslices without a slice target',
    [
      ratioSli(),
      slo({
        budgetingMethod: 'Timeslices',
        objectives: [{ displayName: 'x', target: 0.9, timeSliceWindow: '1h' }],
      }),
    ],
    'timeSliceTarget must be a number in (0, 1]',
  ],
  [
    'Timeslices with a bad slice window',
    [
      ratioSli(),
      slo({
        budgetingMethod: 'Timeslices',
        objectives: [
          {
            displayName: 'x',
            target: 0.9,
            timeSliceTarget: 0.9,
            timeSliceWindow: 'hourly',
          },
        ],
      }),
    ],
    'timeSliceWindow "hourly"',
  ],
  [
    'a slice window on Occurrences',
    [
      ratioSli(),
      slo({
        objectives: [{ displayName: 'x', target: 0.9, timeSliceWindow: '1h' }],
      }),
    ],
    'timeSliceWindow applies only to budgetingMethod Timeslices',
  ],
  [
    'an unknown budgeting method',
    [ratioSli(), slo({ budgetingMethod: 'RatioTimeslices' })],
    'budgetingMethod must be one of Occurrences, Timeslices',
  ],
  [
    'two time windows',
    [
      ratioSli(),
      slo({
        timeWindow: [
          { duration: '1d', isRolling: true },
          { duration: '7d', isRolling: true },
        ],
      }),
    ],
    'timeWindow must be a list of exactly one window',
  ],
  [
    'a rolling window with a calendar',
    [
      ratioSli(),
      slo({
        timeWindow: [
          {
            duration: '1d',
            isRolling: true,
            calendar: { startTime: '2026-01-01 00:00:00', timeZone: 'UTC' },
          },
        ],
      }),
    ],
    'a rolling window has no calendar',
  ],
  [
    'a calendar window in another time zone',
    [
      ratioSli(),
      slo({
        timeWindow: [
          {
            duration: '1w',
            isRolling: false,
            calendar: {
              startTime: '2026-01-05 00:00:00',
              timeZone: 'Europe/Paris',
            },
          },
        ],
      }),
    ],
    'calendar.timeZone Europe/Paris is not supported (only UTC)',
  ],
  [
    'a calendar start that is no date',
    [
      ratioSli(),
      slo({
        timeWindow: [
          {
            duration: '1w',
            isRolling: false,
            calendar: { startTime: '2026-02-30 00:00:00', timeZone: 'UTC' },
          },
        ],
      }),
    ],
    'calendar.startTime "2026-02-30 00:00:00" must be YYYY-MM-DD HH:MM:SS',
  ],
  [
    'no objectives',
    [ratioSli(), slo({ objectives: [] })],
    'objectives must be a non-empty list',
  ],
  [
    'neither indicatorRef nor indicator',
    [ratioSli(), slo({ indicatorRef: undefined })],
    'spec needs exactly one of indicatorRef and indicator',
  ],
];

describe('issues', () => {
  test.each(cases)('%s', (_label, docs, issue) => {
    const issues = issuesOf(...docs);
    expect(issues.some((i) => i.includes(issue))).toBe(true);
  });

  test('YAML that does not parse', () => {
    expect(parseOpenSlo('kind: [SLI').ok).toBe(false);
  });

  test('an empty file declares nothing', () => {
    expect(parseOpenSlo('')).toEqual({
      ok: false,
      issues: ['the file declares no SLI or SLO'],
    });
  });

  test('a document that is not a mapping', () => {
    expect(issuesOf(ratioSli(), slo()).length).toBe(0);
    const parsed = parseOpenSlo(
      `${yaml(ratioSli(), slo())}\n---\njust words\n`
    );
    expect(parsed.ok ? [] : parsed.issues).toEqual([
      'document 3: must be a mapping with apiVersion, kind, metadata and spec',
    ]);
  });
});
