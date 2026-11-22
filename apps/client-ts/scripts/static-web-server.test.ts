import { expect, test } from 'bun:test';

// regression: static-web-server-runtime-declaration
test('the production static web server links real runtime exports', async () => {
  const result = await Bun.build({
    entrypoints: [`${import.meta.dirname}/static-web-server.ts`],
    target: 'bun',
  });
  expect(result.logs).toEqual([]);
  expect(result.success).toBe(true);
});
