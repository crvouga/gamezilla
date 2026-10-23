import { describe, expect, test } from 'bun:test';
import {
  createHttpReportFetcher,
  memoryReportCache,
  reportQueryClient,
} from '@crvouga/atlas/reports/fetcher';
import { attachReportCache } from '@crvouga/atlas/reports/persist';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';

const API = 'https://api.test/api/reports';
const SHA = 'e'.repeat(40);

function htmlClient(body: () => Response): HttpClient & { hits: number } {
  let hits = 0;
  return {
    get hits() {
      return hits;
    },
    fetch() {
      hits += 1;
      return Promise.resolve(body());
    },
  };
}

async function saved(
  cache: ReturnType<typeof memoryReportCache>
): Promise<string> {
  for (let turn = 0; turn < 50; turn += 1) {
    const raw = await cache.get('reports-query-cache');
    if (raw !== null) return raw;
    await Promise.resolve();
  }
  throw new Error('query cache was not written');
}

describe('the reports query cache', () => {
  test('a frame file is fetched once, and a new client reuses the byte cache', async () => {
    const http = htmlClient(
      () =>
        new Response('<html>hello</html>', {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
    );
    const cache = memoryReportCache();
    const first = createHttpReportFetcher({
      http,
      apiBase: API,
      client: reportQueryClient(),
      cache,
    });
    const blob = await first.blob(
      SHA,
      'libs-chess--part-0',
      'kv-put',
      'frames/a.html'
    );
    expect(blob?.text).toContain('hello');
    await first.blob(SHA, 'libs-chess--part-0', 'kv-put', 'frames/a.html');
    expect(http.hits).toBe(1);

    const second = createHttpReportFetcher({
      http,
      apiBase: API,
      client: reportQueryClient(),
      cache,
    });
    const again = await second.blob(
      SHA,
      'libs-chess--part-0',
      'kv-put',
      'frames/a.html'
    );
    expect(again?.text).toContain('hello');
    expect(http.hits).toBe(1);
  });

  test('a missing frame is not remembered, so the next scrub can load it', async () => {
    let status = 404;
    const http = htmlClient(
      () =>
        new Response(status === 200 ? '<html>later</html>' : null, {
          status,
          headers: { 'content-type': 'text/html' },
        })
    );
    const fetcher = createHttpReportFetcher({
      http,
      apiBase: API,
      client: reportQueryClient(),
      cache: memoryReportCache(),
    });
    expect(
      await fetcher.blob(SHA, 'libs-chess--part-0', 'kv-put', 'frames/a.html')
    ).toBeNull();
    status = 200;
    const blob = await fetcher.blob(
      SHA,
      'libs-chess--part-0',
      'kv-put',
      'frames/a.html'
    );
    expect(blob?.text).toContain('later');
    expect(http.hits).toBe(2);
  });

  test('the persisted document keeps timelines and drops frame files', async () => {
    const cache = memoryReportCache();
    const client = reportQueryClient();
    const [unsubscribe, restored] = attachReportCache(client, cache);
    await restored;
    await client.fetchQuery({
      queryKey: ['reports', 'sources', SHA],
      queryFn: async () => [{ source: 'libs-chess--part-0' }],
    });
    await client.fetchQuery({
      queryKey: ['reports', 'blob', SHA, 'src', 'id', 'frames/a.html'],
      queryFn: async () => ({ contentType: 'text/html', text: 'SECRET_HTML' }),
    });
    const raw = await saved(cache);
    expect(raw).toContain('libs-chess--part-0');
    expect(raw).not.toContain('SECRET_HTML');
    unsubscribe();

    const next = reportQueryClient();
    const [done, restoreNext] = attachReportCache(next, cache);
    await restoreNext;
    const restoredSources: unknown = next.getQueryData([
      'reports',
      'sources',
      SHA,
    ]);
    expect(restoredSources).toEqual([{ source: 'libs-chess--part-0' }]);
    expect(
      next.getQueryData(['reports', 'blob', SHA, 'src', 'id', 'frames/a.html'])
    ).toBeUndefined();
    done();
  });
});
