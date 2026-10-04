import { describe, expect, test } from 'bun:test';
import { parseArgs } from '@pkgs/observability-cli-shared/args';
import { runCommand } from '@pkgs/observability-cli-shared/commands';
import { assertTraceHasSpan } from '@pkgs/observability-shared/assert-trace';
import { ATTR } from '@pkgs/observability-shared/attributes';
import { EVENT } from '@pkgs/observability-shared/events';
import { NdjsonTraceStore } from '@pkgs/observability-shared/ndjson';
import {
  createGymFixtures,
  GYM_IDS,
  GYM_MUTATION_ID,
  GYM_NOW_MS,
  GYM_TEST_ID,
} from './gym-fixtures';

const fixturesPromise = createGymFixtures();

async function fixtureStore(
  fixtures?: Readonly<Record<string, string>>
): Promise<NdjsonTraceStore> {
  const resolvedFixtures = fixtures ?? (await fixturesPromise);
  const values = new Map(Object.entries(resolvedFixtures));
  return new NdjsonTraceStore(
    {
      async get(key) {
        const value = values.get(key);
        if (value === undefined) return null;
        const bytes = new TextEncoder().encode(value);
        return {
          body: new Blob([bytes]).stream(),
          contentType: 'application/x-ndjson',
          size: bytes.byteLength,
        };
      },
      async put() {},
      async head(key) {
        return values.has(key);
      },
      async delete() {},
      async deleteMany() {},
      async getUri() {
        return null;
      },
      async listKeys() {
        return [...values.keys()].sort();
      },
      withPrefix() {
        return this;
      },
    },
    'debugging-gym'
  );
}

async function obs(...args: readonly string[]): Promise<string> {
  const result = await runCommand(
    { store: await fixtureStore(), nowMs: GYM_NOW_MS },
    parseArgs(args)
  );
  expect(result.code).toBe(0);
  expect(result.text).toStartWith('obs/v1\nsource: debugging-gym');
  expect(result.text).toContain('next: bun obs');
  return result.text;
}

describe('observability debugging gym', () => {
  test('server 500 exposes the violated database constraint', async () => {
    const output = await obs('trace', GYM_IDS.constraint);
    expect(output).toContain('db.insert [ERROR]');
    expect(output).toContain('users_username_key');
    expect(output).toContain(`next: bun obs span ${GYM_IDS.constraint}`);
  });

  test('offline conflict narrates origin and reconnect as one causal chain', async () => {
    const output = await obs('mutation', GYM_MUTATION_ID);
    expect(output).toContain('causal-chain: 2 traces');
    expect(output).toContain(`causal step 1/2: ${GYM_IDS.offlineOrigin}`);
    expect(output).toContain('ui.interaction [OK]');
    expect(output).toContain('offline gap: 299.96s');
    expect(output).toContain(`causal step 2/2: ${GYM_IDS.conflict}`);
    expect(output).toContain(`event ${EVENT.MUTATION_CONFLICT}`);
    expect(output).toContain(`app.mutation.id=${GYM_MUTATION_ID}`);
    expect(output).toContain(
      'caused by 22222222222222222222222222222222/2222222222222222'
    );
  });

  test('offline gap survives after the origin trace ages out', async () => {
    const fixtures = await fixturesPromise;
    const retained = Object.fromEntries(
      Object.entries(fixtures).filter(
        ([name]) => name !== 'offline-origin.ndjson'
      )
    );
    const result = await runCommand(
      { store: await fixtureStore(retained), nowMs: GYM_NOW_MS },
      parseArgs(['mutation', GYM_MUTATION_ID])
    );
    expect(result.code).toBe(0);
    expect(result.text).toContain(
      `linked trace unavailable: ${GYM_IDS.offlineOrigin}`
    );
    expect(result.text).toContain(
      'offline gap: 300.00s (origin trace unavailable -> reconnect)'
    );
  });

  test('successful wrong answer remains visible without an error status', async () => {
    const output = await obs('trace', GYM_IDS.wrongAnswer);
    expect(output).toContain('puzzle.answer [OK]');
    expect(output).toContain('expected move=e2e4 actual move=e2e3');
    expect(output).toContain(
      `next: bun obs trace ${GYM_IDS.wrongAnswer} --json`
    );
  });

  test('slow query drill-down exposes its duration and sqlcommenter context', async () => {
    const overview = await obs('slow', '--layer', 'db', '--p', '95');
    expect(overview).toContain(`${GYM_IDS.slowQuery} db.query 2750.0ms`);
    expect(overview).toContain(`next: bun obs trace ${GYM_IDS.slowQuery}`);

    const detail = await obs('trace', GYM_IDS.slowQuery);
    expect(detail).toContain('db.query [OK]');
    expect(detail).toContain(`${ATTR.DB_QUERY_TEXT}=SELECT id FROM puzzles`);
    expect(detail).toContain(`traceparent=00-${GYM_IDS.slowQuery}`);
  });

  test('client-only exception points to the source location', async () => {
    const output = await obs('trace', GYM_IDS.clientError);
    expect(output).toContain('Cannot read properties of undefined');
    expect(output).toContain('puzzle-screen.tsx:87');
    expect(output).toContain('code.function.name=submitMove');
  });

  test('silent click is diagnosed as no_op where a mutation was expected', async () => {
    const output = await obs('trace', GYM_IDS.noOp);
    expect(output).toContain('app.interaction.target=PuzzleSubmitButton');
    expect(output).toContain('app.interaction.outcome=no_op');
    expect(output).not.toContain('mutation.apply');
  });

  test('failing spec is discoverable by the fixture-injected test ID', async () => {
    const output = await obs('test', GYM_TEST_ID, '--last-failure');
    expect(output).toContain(`app.test.id=${GYM_TEST_ID}`);
    expect(output).toContain('expected synced title, received stale title');
    expect(output).toContain('offline-edits.test.tsx:144');

    const trace = await (await fixtureStore()).getTrace(GYM_IDS.failingTest);
    if (trace === null) throw new Error('failing spec fixture trace missing');
    expect(() =>
      assertTraceHasSpan(trace, { name: 'test.run', status: 'error' })
    ).not.toThrow();
  });
});
