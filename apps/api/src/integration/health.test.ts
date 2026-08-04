import { expect, test } from 'bun:test';

import {
  assertHttpOk,
  resolveLocalApiOrigin,
} from '@libs/integration-test/harness';

test('api GET /health returns ok when preview is already running', async () => {
  const localApiOrigin = await resolveLocalApiOrigin();
  const healthUrl = `${localApiOrigin}/api/health`;

  await assertHttpOk(healthUrl, {
    label: 'API preview (/api/health)',
    startHint:
      'Start the stack first:\n  bun dev\n  bun preview\n\nThen re-run:\n  bun check:api',
  });

  const res = await fetch(healthUrl);
  expect(res.ok).toBe(true);
  expect(await res.json()).toEqual({ status: 'ok' });
});
