import { describe, expect, test } from 'bun:test';
import type { ObsOutcome } from '@libs/observability-server-ts/alert-evidence';
import {
  buildWorkItemsDocument,
  collectEvidence,
} from '@libs/observability-server-ts/alert-evidence';
import {
  evidenceArgs,
  redact,
  traceArgs,
} from '@libs/observability-server-ts/alert-work-items';
import {
  decodeLogBlock,
  encodeLogBlock,
  renderWorkItems,
} from '@libs/observability-server-ts/alert-work-items-render';
import type { ObjectiveFailure } from '@pkgs/openslo-shared-ts/failure';

const SPEC = 'specs/runtime/request-success.openslo.yaml';
const RUNBOOK =
  'https://example.test/product/blob/main/docs/SLO_RUNBOOK.md#the-app-serves-people';
const NOW = Date.parse('2026-11-09T12:00:00Z');

function failure(
  overrides: Partial<ObjectiveFailure> & Pick<ObjectiveFailure, 'check'>
): ObjectiveFailure {
  return {
    environment: 'prd',
    specUri: SPEC,
    slo: 'the-app-serves-people',
    sloDisplayName: 'The app serves people',
    sloDescription: null,
    window: '28d',
    target: 0.9999,
    observed: null,
    considered: null,
    readings: [],
    budgetRemaining: null,
    response: {
      owner: 'runtime',
      runbook: RUNBOOK,
      command: 'bun obs errors --since 1d --source prod --env prd',
    },
    detail: 'failed',
    ...overrides,
  };
}

const missed = failure({
  check: { kind: 'objective', objective: 'At least 99.99% meet this promise' },
  observed: 0.995548,
  considered: 12_357,
  detail:
    'observed 0.995548 (12302/12357 good events) vs target 0.9999; 12357 considered',
});
const dailyBurn = failure({
  check: {
    kind: 'alert',
    policy: 'the-app-serves-people-daily-burn',
    severity: 'ticket',
  },
  readings: [
    { lookbackWindow: '6h', burn: 44.5, threshold: 6, events: 2000 },
    { lookbackWindow: '30m', burn: 40, threshold: 6, events: 300 },
  ],
  budgetRemaining: -3.2,
  response: {
    owner: 'runtime',
    runbook: RUNBOOK,
    command: 'bun obs errors --since 6h --source prod --env prd',
  },
  detail:
    'TICKET the-app-serves-people (the-app-serves-people-daily-burn) is firing',
});
const devPage = failure({
  environment: 'dev',
  check: {
    kind: 'alert',
    policy: 'the-app-serves-people-fast-burn',
    severity: 'page',
  },
  readings: [{ lookbackWindow: '1h', burn: 20, threshold: 14.4, events: 500 }],
  response: {
    owner: 'runtime',
    runbook: RUNBOOK,
    command: 'bun obs errors --since 1h --source prod --env dev',
  },
});

const LEAKED = {
  url: 'postgresql://obs_read:hunter2-supersecret@db.example/neondb',
  bearer: 'Bearer abcdefghijklmnopqrstuvwxyz0123456789',
  // Assembled at run time so the secret scanner never meets a
  // credential-shaped literal in the source.
  jwt: ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0In0', 'c2lnbmF0dXJl'].join(
    '.'
  ),
  stripe: ['sk', 'live', '51HxYzAbCdEfGh'].join('_'),
  email: 'person@example.com',
};

function traceRef(traceId: string, rootName: string, errorCount: number) {
  return {
    traceId,
    rootName,
    errorCount,
    durationMs: errorCount * 100 + 50,
    spanCount: 3,
    startedAtMs: NOW - 60_000,
  };
}

const SEARCH = JSON.stringify({
  format: 'obs/v1',
  data: {
    range: { startMs: NOW - 86_400_000, endMs: NOW },
    traces: [
      traceRef('a'.repeat(32), 'POST /api/mutations', 2),
      traceRef('b'.repeat(32), 'POST /api/mutations', 1),
      traceRef('c'.repeat(32), `GET /api/query?token=${LEAKED.stripe}`, 1),
      traceRef('d'.repeat(32), 'GET /health', 0),
    ],
    truncations: [],
  },
});

function traceJson(message: string): string {
  return JSON.stringify({
    format: 'obs/v1',
    data: {
      traceId: 'x',
      spans: [
        {
          traceId: 'x',
          spanId: '1',
          name: 'db.query',
          startTimeMs: NOW,
          durationMs: 5,
          status: 'error',
          statusMessage: message,
          attributes: {},
        },
        {
          traceId: 'x',
          spanId: '2',
          name: 'http',
          startTimeMs: NOW,
          durationMs: 5,
          status: 'ok',
          attributes: {},
        },
      ],
    },
  });
}

/** A fake `bun obs`: the search, then each opened trace. */
function fakeObs(
  calls: (readonly string[])[]
): (args: readonly string[]) => ObsOutcome {
  return (args) => {
    calls.push(args);
    if (args[0] === 'trace') {
      const message =
        args[1] === 'c'.repeat(32)
          ? `connect failed for ${LEAKED.url} (${LEAKED.bearer}) user ${LEAKED.email} ${LEAKED.jwt}`
          : 'deadlock detected';
      return { code: 0, stdout: traceJson(message), stderr: '' };
    }
    return { code: 0, stdout: SEARCH, stderr: '' };
  };
}

function documentFor(failures: readonly ObjectiveFailure[]) {
  const calls: (readonly string[])[] = [];
  const doc = buildWorkItemsDocument({
    failures,
    environments: ['dev', 'prd'],
    generatedAt: '2026-11-09T12:00:00.000Z',
    ports: { obs: fakeObs(calls), nowMs: () => NOW, deadlineMs: NOW + 1 },
  });
  return { doc, calls };
}

describe('work items', () => {
  test('one per failing objective per environment, pages first, each naming its environment and file', () => {
    const { doc } = documentFor([missed, dailyBurn, devPage]);
    expect(doc.items.map((i) => i.id)).toEqual([
      'dev:the-app-serves-people',
      'prd:the-app-serves-people',
    ]);
    const prd = doc.items[1]!;
    expect(prd.environment).toBe('prd');
    expect(prd.specUri).toBe(SPEC);
    expect(prd.runbook).toBe(RUNBOOK);
    expect(prd.owner).toBe('runtime');
    expect(prd.checks.map((c) => c.id)).toEqual([
      'objective:the-app-serves-people:At least 99.99% meet this promise',
      'alert:the-app-serves-people:the-app-serves-people-daily-burn',
    ]);
    expect(prd.numbers).toMatchObject({
      window: '28d',
      target: 0.9999,
      observed: 0.995548,
      considered: 12_357,
      budgetRemaining: -3.2,
    });
    expect(prd.numbers.burnRates.map((b) => b.lookbackWindow)).toEqual([
      '6h',
      '30m',
    ]);
    expect(prd.whatIsBroken).toContain('In prd, "The app serves people"');
    expect(prd.whatIsBroken).toContain('99.5548% of 12357');
    expect(prd.whatIsBroken).toContain('44.5x faster than allowed over 6h');
  });

  test("the longest investigate command is run, read-only, as JSON, in the item's environment", () => {
    const { doc, calls } = documentFor([missed, dailyBurn]);
    expect(calls[0]).toEqual([
      'errors',
      '--since',
      '1d',
      '--source',
      'prod',
      '--env',
      'prd',
      '--json',
    ]);
    expect(calls.slice(1).every((c) => c[0] === 'trace')).toBe(true);
    expect(calls).toHaveLength(4);
    expect(doc.items[0]!.investigate).toBe(
      'bun obs errors --since 1d --source prod --env prd'
    );
    expect(doc.items[0]!.inspect).toContain(
      `bun obs trace ${'a'.repeat(32)} --source prod --env prd`
    );
    expect(doc.items[0]!.provesFixed[0]).toBe(
      `SECRETS_ENV=prd bun run --filter @apps/product-ts health:objectives ${SPEC}   # every check of the objective passes`
    );
  });

  test('evidence is grouped by route and message and counted', () => {
    const { doc } = documentFor([missed]);
    const { evidence } = doc.items[0]!;
    expect(evidence.status).toBe('collected');
    expect(evidence.routes[0]).toEqual({
      route: 'POST /api/mutations',
      traces: 2,
      errorTraces: 2,
      slowestMs: 250,
    });
    expect(evidence.routes.map((r) => r.route)).toEqual([
      'POST /api/mutations',
      'GET /api/query?token=***',
      'GET /health',
    ]);
    expect(evidence.messages[0]).toEqual({
      message: 'deadlock detected',
      count: 2,
    });
    expect(evidence.traces[0]?.traceId).toBe('a'.repeat(32));
  });

  test('no secret or address the telemetry carries reaches the item, its JSON or its Markdown', () => {
    const { doc } = documentFor([missed]);
    const outputs = [JSON.stringify(doc), renderWorkItems(doc)];
    for (const output of outputs) {
      for (const leaked of [
        'hunter2-supersecret',
        'abcdefghijklmnopqrstuvwxyz0123456789',
        LEAKED.jwt,
        LEAKED.stripe,
        LEAKED.email,
      ])
        expect(output).not.toContain(leaked);
    }
    expect(doc.items[0]!.evidence.messages.map((m) => m.message)).toContain(
      'connect failed for postgresql://***@db.example/neondb (Bearer ***) user <email> ***'
    );
  });

  test('a query that cannot run says why and never throws', () => {
    const stopped = collectEvidence([missed], {
      obs: () => ({
        code: 3,
        stdout: '',
        stderr: `obs/v1\nstore unreachable: ${LEAKED.url}\n`,
      }),
      nowMs: () => NOW,
      deadlineMs: NOW + 1,
    });
    expect(stopped.status).toBe('unavailable');
    expect(stopped.note).toBe(
      'bun obs exited 3: store unreachable: postgresql://***@db.example/neondb'
    );
    const late = collectEvidence([missed], {
      obs: () => {
        throw new Error('must not run');
      },
      nowMs: () => NOW + 2,
      deadlineMs: NOW + 1,
    });
    expect(late.status).toBe('skipped');
    const silent = collectEvidence([{ ...missed, response: null }], {
      obs: () => ({ code: 0, stdout: SEARCH, stderr: '' }),
      nowMs: () => NOW,
      deadlineMs: NOW + 1,
    });
    expect(silent).toMatchObject({ status: 'skipped', command: null });
  });

  test('only read-only bun obs searches run', () => {
    expect(evidenceArgs('bun obs slow --since 1h --source prod')).toEqual([
      'slow',
      '--since',
      '1h',
      '--source',
      'prod',
      '--json',
    ]);
    expect(evidenceArgs('bun obs platform --service api')).toBeNull();
    expect(evidenceArgs('rm -rf / # bun obs errors')).toBeNull();
    expect(evidenceArgs(null)).toBeNull();
    expect(
      traceArgs(
        ['errors', '--since', '1d', '--source', 'prod', '--env', 'dev'],
        'f00'
      )
    ).toEqual(['trace', 'f00', '--source', 'prod', '--env', 'dev', '--json']);
  });

  test('trace ids and plain routes survive redaction', () => {
    const id = '0123456789abcdef0123456789abcdef';
    expect(
      redact(`trace ${id} on GET /api/some/long/path/with/many/segments`)
    ).toBe(`trace ${id} on GET /api/some/long/path/with/many/segments`);
  });
});

describe('the job log carries the document', () => {
  test('round trip through a GitHub log line, the last one winning', () => {
    const { doc } = documentFor([missed]);
    const empty = { ...doc, items: [] };
    const log = [
      `health:objectives\tCollect\t2026-11-09T12:00:00.0Z ${encodeLogBlock(empty)}`,
      'noise HEALTH_ALERTS_V1 not-base64-json',
      `health:objectives\tCollect\t2026-11-09T12:00:01.0Z ${encodeLogBlock(doc)}`,
    ].join('\n');
    expect(decodeLogBlock(log)).toEqual(doc);
    expect(decodeLogBlock('no marker here')).toBeNull();
  });

  test('a run with nothing open says so', () => {
    const { doc } = documentFor([]);
    expect(doc.items).toEqual([]);
    expect(renderWorkItems(doc)).toContain(
      'Every objective is met and no alert is firing.'
    );
  });
});
