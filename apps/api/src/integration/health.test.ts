// @io-wall-ok
import { expect, test } from 'bun:test';
import { wallIo } from '@pkgs/io';

/** Loopback origin for `wrangler dev` in this repo (`apps/api` uses port 8788). */
const DEFAULT_LOCAL_PREVIEW_API_ORIGIN = 'http://localhost:8788';

const io = wallIo();

test('api GET /health returns ok when preview is already running', async () => {
  const fromEnv = process.env['LOCAL_PREVIEW_API_ORIGIN']?.trim();
  const localApiOrigin =
    fromEnv !== undefined && fromEnv.length > 0
      ? fromEnv
      : DEFAULT_LOCAL_PREVIEW_API_ORIGIN;
  const healthUrl = `${localApiOrigin}/api/health`;

  let lastErr: string | undefined;
  try {
    const probe = await io.http.fetch(healthUrl);
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
        'Start the stack first:\n  bun dev\n  bun preview\n\nThen re-run:\n  bun check:api',
        '',
      ].join('\n')
    );
  }

  const res = await io.http.fetch(healthUrl);
  expect(res.ok).toBe(true);
  expect(await res.json()).toEqual({ status: 'ok' });
});
