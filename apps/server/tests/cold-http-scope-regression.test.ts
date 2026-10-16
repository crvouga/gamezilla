import '@apps/server/worker';
import { expect, test } from 'bun:test';
import { createScopedHttpClient } from '@pkgs/http-client-shared/scoped-http-client';

test('cold server entry isolates overlapping HTTP owners before lazy product boot', async () => {
  // regression: cold-server-http-scope-overlap
  const http = createScopedHttpClient({
    fetch: async () => Response.json({ ok: true }),
  });
  const entered = Promise.withResolvers<void>();
  const completed = Promise.withResolvers<void>();
  const first = http.run(async () => {
    entered.resolve();
    await completed.promise;
    const response = await http.fetch('https://collector.example/first');
    expect(await response.json()).toEqual({ ok: true });
  });
  await entered.promise;
  const releaseSecond = Promise.withResolvers<void>();
  const second = http.run(async () => {
    await releaseSecond.promise;
    const response = await http.fetch('https://collector.example/second');
    expect(await response.json()).toEqual({ ok: true });
  });
  completed.resolve();
  await first;
  releaseSecond.resolve();
  await second;
  await http.run(async () => {
    const response = await http.fetch('https://collector.example/next');
    expect(await response.json()).toEqual({ ok: true });
  });
});
