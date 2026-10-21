import { describe, expect, test } from 'bun:test';
import { parseArgs } from '@pkgs/observability-cli-shared/args';
import { runCommand } from '@pkgs/observability-cli-shared/commands';
import { NdjsonTraceStore } from '@pkgs/observability-root-shared/ndjson';

const NOW_MS = Date.parse('2026-10-21T03:00:00.000Z');
const AT_MS = Date.parse('2026-10-21T02:00:00.000Z');

function storeOf(spans: readonly object[]): NdjsonTraceStore {
  const bytes = new TextEncoder().encode(
    spans.map((span) => JSON.stringify(span)).join('\n')
  );
  return new NdjsonTraceStore(
    {
      async get() {
        return {
          body: new Blob([bytes]).stream(),
          contentType: 'application/x-ndjson',
          size: bytes.byteLength,
        };
      },
      async put() {},
      async head() {
        return true;
      },
      async delete() {},
      async deleteMany() {},
      async getUri() {
        return null;
      },
      async listKeys() {
        return ['spans.ndjson'];
      },
      withPrefix() {
        return this;
      },
    },
    'fixture'
  );
}

function span(
  index: number,
  offsetMs: number,
  name: string,
  more: object = {}
): object {
  return {
    timestamp: new Date(AT_MS + offsetMs).toISOString(),
    traceId: index.toString(16).padStart(32, '0'),
    spanId: index.toString(16).padStart(16, '0'),
    name,
    durationMs: 4,
    status: 'ok',
    events: [],
    attributes: { 'user.id': 'user-ada' },
    ...more,
  };
}

const DIRECTORY = {
  resolve: async () => null,
  async resolvePeople(name: string) {
    return name === 'Ada Lovelace'
      ? [{ userId: 'user-ada', matchedAs: 'name' as const }]
      : [];
  },
};

async function person(spans: readonly object[], ...flags: readonly string[]) {
  return runCommand(
    { store: storeOf(spans), nowMs: NOW_MS, identityResolver: DIRECTORY },
    parseArgs(['person', '--name', 'Ada Lovelace', '--at', '7pm MST', ...flags])
  );
}

describe('bun obs person', () => {
  test('activity with no error exits 0 and still prints the timeline', async () => {
    const result = await person([span(1, 0, 'route.change')]);
    expect(result.code).toBe(0);
    expect(result.text).toContain(
      'No error was recorded; 0 requests, 0 mutations'
    );
    expect(result.text).toContain('route change');
  });

  test('nothing in the window exits 1 and names the last time the account was seen', async () => {
    const result = await person([span(1, -3 * 3_600_000, 'route.change')]);
    expect(result.code).toBe(1);
    expect(result.text).toContain(
      'Nothing happened for Ada Lovelace at that time.'
    );
    expect(result.text).toContain('last seen: 2026-10-20 16:00:00 MST');
    expect(result.text).toContain(
      'next: bun obs person --name "Ada Lovelace" --at "2026-10-20 16:00 MST" --window 30m'
    );
  });

  test('an unknown account exits 1 and is not a quiet one', async () => {
    const result = await runCommand(
      { store: storeOf([]), nowMs: NOW_MS, identityResolver: DIRECTORY },
      parseArgs(['person', '--name', 'Nobody Home', '--at', '7pm MST'])
    );
    expect(result.code).toBe(1);
    expect(result.text).toContain('No account is named "Nobody Home"');
  });

  test('drill-down commands repeat the --source that was asked', async () => {
    const result = await person(
      [span(1, 0, 'client.error', { status: 'error', statusMessage: 'boom' })],
      '--source',
      'prod'
    );
    expect(result.text).toContain(
      `bun obs span ${'1'.padStart(32, '0')} ${'1'.padStart(16, '0')} --source prod`
    );
    expect(result.text).toContain('--window 2h --source prod');
  });

  test('--json carries the typed structure and the exit code', async () => {
    const result = await person(
      [span(1, 0, 'client.error', { status: 'error', statusMessage: 'boom' })],
      '--json'
    );
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.text) as {
      readonly format: string;
      readonly data: {
        readonly schema: string;
        readonly status: string;
        readonly problems: readonly { readonly message: string }[];
        readonly clock: { readonly zoneLabel: string };
      };
    };
    expect(parsed.format).toBe('obs/v1');
    expect(parsed.data.schema).toBe('obs.person/v1');
    expect(parsed.data.status).toBe('trouble');
    expect(parsed.data.problems[0]?.message).toBe('boom');
    expect(parsed.data.clock.zoneLabel).toBe('MST');
  });

  test('--json for a quiet account still exits 1', async () => {
    const result = await person([], '--json');
    expect(result.code).toBe(1);
    expect(
      (JSON.parse(result.text) as { data: { status: string } }).data.status
    ).toBe('quiet');
  });

  test('--slow-ms moves the slow threshold and a bad value is usage', async () => {
    const slow = span(1, 0, 'outbox.drain', { durationMs: 400 });
    expect((await person([slow])).text).not.toContain('SLOW outbox.drain');
    expect((await person([slow], '--slow-ms', '300')).text).toContain(
      'SLOW outbox.drain'
    );
    expect((await person([slow], '--slow-ms', 'soon')).code).toBe(2);
  });

  test('--all prints every timeline row', async () => {
    const many = Array.from({ length: 90 }, (_, index) =>
      span(index + 1, index * 1_000, 'route.change', {
        attributes: {
          'user.id': 'user-ada',
          'app.interaction.target': `t${index}`,
        },
      })
    );
    const capped = await person(many);
    expect(capped.text).toContain('rows elided');
    const all = await person(many, '--all');
    expect(all.text).not.toContain('rows elided');
    expect(all.text).toContain('route change t89');
  });

  test('a clock with no zone is usage', async () => {
    const result = await runCommand(
      { store: storeOf([]), nowMs: NOW_MS, identityResolver: DIRECTORY },
      parseArgs(['person', '--name', 'Ada Lovelace', '--at', '7pm'])
    );
    expect(result.code).toBe(2);
    expect(result.text).toContain('needs a zone');
  });

  test('--timezone completes a clock that has none', async () => {
    const result = await runCommand(
      {
        store: storeOf([span(1, 0, 'route.change')]),
        nowMs: NOW_MS,
        identityResolver: DIRECTORY,
      },
      parseArgs([
        'person',
        '--name',
        'Ada Lovelace',
        '--at',
        '7pm',
        '--timezone',
        'MST',
      ])
    );
    expect(result.code).toBe(0);
  });
});
