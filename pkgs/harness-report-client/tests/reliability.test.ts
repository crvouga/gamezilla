import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import {
  createHttpReportFetcher,
  memoryReportCache,
  ReportsUnavailable,
  reportQueryClient,
} from '@pkgs/harness-report-client/fetcher';
import { createRemoteReport } from '@pkgs/harness-report-client/remote-report';
import { resilientReportCache } from '@pkgs/harness-report-client/resilient-cache';
import type {
  CommitEvent,
  SourceRecord,
} from '@pkgs/harness-report-shared/protocol';
import { encodeSseEvent } from '@pkgs/harness-report-shared/protocol';
import { createRoot } from 'solid-js';

const SHA = '1'.repeat(40);
const API = 'https://example.test/reports';
const SOURCE: SourceRecord = {
  source: 'example--all',
  packageDir: 'pkgs/example',
  bucket: 'all',
  updatedAtMs: 10,
  status: 'passed',
  tests: [],
};
async function until(ready: () => boolean) {
  for (let turn = 0; turn < 500 && !ready(); turn += 1) await Promise.resolve();
  expect(ready()).toBe(true);
}

// regression: reports-unavailable-hidden
test('a literal 503 immediately rejects and a new request can recover', async () => {
  let status = 503;
  let requests = 0;
  const client = reportQueryClient();
  const fetcher = createHttpReportFetcher({
    client,
    cache: memoryReportCache(),
    apiBase: API,
    http: {
      fetch: async () => {
        requests += 1;
        return Response.json({ commits: [], cursor: null }, { status });
      },
    },
  });
  await expect(fetcher.commits(null)).rejects.toBeInstanceOf(
    ReportsUnavailable
  );
  expect(requests).toBe(1);
  status = 200;
  expect(await fetcher.commits(null)).toEqual({ commits: [], cursor: null });
  expect(requests).toBe(2);
  client.clear();
});

// regression: reports-cache-blocked
test('denied persistent storage retains usable memory without blocking reads', async () => {
  const fail = async () => {
    throw new Error('SecurityError');
  };
  const cache = resilientReportCache({ get: fail, set: fail, remove: fail });
  await cache.set('frame', '<html>example</html>');
  expect(await cache.get('frame')).toBe('<html>example</html>');
  await cache.remove('frame');
  expect(await cache.get('frame')).toBeNull();
});

// regression: report-stale-source
test('authoritative streamed outcomes replace a late stale cached source', async () => {
  const { timers } = createHarnessClock();
  const current = { ...SOURCE, status: 'failed' as const, updatedAtMs: 20 };
  const events: CommitEvent[] = [
    { type: 'source', source: current },
    { type: 'end', state: 'complete' },
  ];
  const http = {
    fetch: async () => new Response(events.map(encodeSseEvent).join('')),
  };
  const client = reportQueryClient();
  const fetcher = createHttpReportFetcher({
    http,
    client,
    cache: memoryReportCache(),
    apiBase: API,
  });
  const remote = createRoot(() =>
    createRemoteReport({
      http,
      timers,
      apiBase: API,
      sha: SHA,
      fetcher: {
        ...fetcher,
        sources: async () => {
          for (let i = 0; i < 40; i += 1) await Promise.resolve();
          return [SOURCE];
        },
        frameCss: async () => {
          throw new Error('stylesheet unavailable');
        },
      },
    })
  );
  await until(
    () => remote.phase() === 'complete' && remote.frameCss() !== undefined
  );
  expect(remote.sources()).toEqual([current]);
  remote.dispose();
  client.clear();
});

// regression: report-viewer-leaked-timer
test('disposing a failed stream cancels its pending reconnect', async () => {
  const { clock, timers } = createHarnessClock();
  let requests = 0;
  const http = {
    fetch: async () => {
      requests += 1;
      return new Response(null, { status: 503 });
    },
  };
  const client = reportQueryClient();
  const fetcher = createHttpReportFetcher({
    http,
    client,
    cache: memoryReportCache(),
    apiBase: API,
  });
  const remote = createRoot(() =>
    createRemoteReport({ http, timers, apiBase: API, sha: SHA, fetcher })
  );
  await until(() => clock.pendingOneShotCount() === 1);
  remote.dispose();
  expect(clock.pendingOneShotCount()).toBe(0);
  const before = requests;
  clock.advance(3000);
  await Promise.resolve();
  expect(requests).toBe(before);
  client.clear();
});
