import { expect, test } from 'bun:test';

// regression: preview-server-runtime-declaration
test('production browser specification preview links real runtime exports', async () => {
  const result = await Bun.build({
    entrypoints: [`${import.meta.dirname}/preview-server.ts`],
    target: 'bun',
  });
  expect(result.logs).toEqual([]);
  expect(result.success).toBe(true);
});
