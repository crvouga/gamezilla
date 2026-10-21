import { expect, test } from 'bun:test';
import {
  backgroundWork,
  newestTrailAgeMs,
  signedInRequests,
  trailEnvironments,
  unknownEnvironments,
} from '@libs/observability-server/trail-probes';
import type { HttpClient } from '@pkgs/http-client-shared/types';

const ACCESS = {
  tempoUrl: 'https://tempo.example/tempo',
  tempoUser: '42',
  tempoToken: 'read',
};
const NOW = Date.parse('2026-10-21T08:00:00.000Z');
const WINDOW = { nowMs: NOW, lookbackMs: 10 * 60_000 };

function tempo(
  answer: (url: URL) => { status?: number; body: unknown }
): HttpClient & { readonly urls: URL[] } {
  const urls: URL[] = [];
  return {
    urls,
    async fetch(input) {
      const url = new URL(String(input));
      urls.push(url);
      const { status = 200, body } = answer(url);
      return Response.json(body, { status });
    },
  };
}

test('the trail is as old as the newest scheduled drain of the environment', async () => {
  const http = tempo(() => ({
    body: {
      traces: [
        { startTimeUnixNano: String((NOW - 90_000) * 1_000_000) },
        { startTimeUnixNano: String((NOW - 30_000) * 1_000_000) },
      ],
    },
  }));
  expect(
    await newestTrailAgeMs(http, ACCESS, { ...WINDOW, environment: 'prd' })
  ).toBe(30_000);
  const query = http.urls[0]?.searchParams.get('q') ?? '';
  expect(query).toContain('outbox.drain');
  expect(query).toContain('"prd"');
});

test('a trail with nothing in the window has no age, never a fresh one', async () => {
  const http = tempo(() => ({ body: { traces: [] } }));
  expect(
    await newestTrailAgeMs(http, ACCESS, { ...WINDOW, environment: 'prd' })
  ).toBeNull();
});

test('an unreadable trail is an error, not an empty one', async () => {
  const http = tempo(() => ({ status: 401, body: {} }));
  await expect(
    newestTrailAgeMs(http, ACCESS, { ...WINDOW, environment: 'prd' })
  ).rejects.toThrow('Tempo answered 401');
});

// regression: browser-traces-claim-their-own-environment
test('an environment no deployment owns is named, the probes own are not', async () => {
  const http = tempo(() => ({
    body: {
      tagValues: [
        { type: 'string', value: 'prd' },
        { type: 'string', value: 'prod' },
        { type: 'string', value: 'health-probe' },
        { type: 'string', value: 'dev' },
      ],
    },
  }));
  const found = await trailEnvironments(http, ACCESS, WINDOW);
  expect(unknownEnvironments(found, ['dev', 'prd'])).toEqual(['prod']);
});

test('requests that need an account but name none are counted', async () => {
  const http = tempo((url) => {
    const named = (url.searchParams.get('q') ?? '').includes('user.id != nil');
    return {
      body: {
        traces: Array.from({ length: named ? 3 : 5 }, () => ({
          startTimeUnixNano: '1',
        })),
      },
    };
  });
  expect(
    await signedInRequests(http, ACCESS, { ...WINDOW, environment: 'prd' })
  ).toEqual({ answered: 5, nameless: 2 });
});

// regression: outbox-failed-consumer-aborts-whole-drain
test('a drain that mostly fails is counted, so it cannot hide behind quiet traffic', async () => {
  const http = tempo((url) => {
    const failures = (url.searchParams.get('q') ?? '').includes(
      'status = error'
    );
    return {
      body: {
        traces: Array.from({ length: failures ? 2 : 3 }, () => ({
          startTimeUnixNano: '1',
        })),
      },
    };
  });
  expect(
    await backgroundWork(http, ACCESS, { ...WINDOW, environment: 'prd' })
  ).toEqual({ runs: 3, failed: 2 });
});
