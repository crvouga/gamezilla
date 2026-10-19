// @io-wall-ok
import { expect, test } from 'bun:test';

/** Loopback origin for `wrangler dev` in this repo (`apps/server` uses port 8788). */
const DEFAULT_LOCAL_PREVIEW_API_ORIGIN = 'http://localhost:8788';

test('api GET /health returns ok when preview is already running', async () => {
  const fromEnv = process.env['LOCAL_PREVIEW_API_ORIGIN']?.trim();
  const localApiOrigin =
    fromEnv !== undefined && fromEnv.length > 0
      ? fromEnv
      : DEFAULT_LOCAL_PREVIEW_API_ORIGIN;
  const healthUrl = `${localApiOrigin}/api/health`;

  let lastErr: string | undefined;
  try {
    const probe = await globalThis.fetch(healthUrl);
    if (!probe.ok) {
      lastErr = `HTTP ${String(probe.status)}`;
    } else {
      lastErr = undefined;
    }
  } catch (e) {
    lastErr = e instanceof Error ? e.message : String(e);
  }
  if (lastErr !== undefined) {
    throw new Error(
      [
        '',
        '══════════════════════════════════════════════════════════════════',
        '  API preview (/api/health) is not running',
        '══════════════════════════════════════════════════════════════════',
        '',
        'Integration tests do not start servers.',
        '',
        `Probe failed: ${healthUrl}`,
        `Last error: ${lastErr}`,
        '',
        'Start the stack first:\n  bun preview\n\nOr use the orchestrator:\n  bun run --filter @apps/server verify:api',
        '',
      ].join('\n')
    );
  }

  const res = await globalThis.fetch(healthUrl);
  expect(res.ok).toBe(true);
  expect(await res.json()).toEqual({ status: 'ok' });
});
