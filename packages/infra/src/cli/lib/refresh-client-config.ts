import { assert } from '@gamezilla/shared/assert';
import type { CiPlatform } from '../platform/platform';
import { fail, fmtMs, info, ok } from './fmt';
import type { InfraOutputs } from './infra-outputs';

function clientConfigRefreshUrl(apiUrl: string): string {
  const base = apiUrl.replace(/\/+$/, '');
  return `${base}/client-config/refresh`;
}

/**
 * POSTs to the API so the Worker writes the latest client runtime config into
 * PatchDB. Run only after smoke tests pass (deploy pipeline step).
 */
export async function refreshClientConfig(
  platform: CiPlatform,
  outputs: InfraOutputs
): Promise<void> {
  const url = clientConfigRefreshUrl(outputs.api_url);
  info('Target', url);

  const timeoutMs = 30_000;
  const t0 = performance.now();

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  } catch (e) {
    const elapsedStr = fmtMs(performance.now() - t0);
    const msg = e instanceof Error ? e.message : String(e);
    fail('Client config refresh', `${msg} (${elapsedStr})`);
    platform.error(`client-config refresh: request failed — ${msg} (${url})`);
    assert.fail(`client-config refresh: ${msg}`);
  }

  const elapsed = performance.now() - t0;
  const elapsedStr = fmtMs(elapsed);

  if (!res.ok) {
    const bodyPreview = await res.text().catch(() => '');
    const detail = bodyPreview ? ` — body: ${bodyPreview.slice(0, 200)}` : '';
    fail(
      'Client config refresh',
      `HTTP ${res.status} from ${url} (${elapsedStr})${detail}`
    );
    platform.error(
      `client-config refresh failed: HTTP ${res.status} ${url} (${elapsedStr})`
    );
    assert.fail(`client-config refresh: expected 2xx, got HTTP ${res.status}`);
  }

  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    fail('Client config refresh', `response was not JSON (${elapsedStr})`);
    platform.error(`client-config refresh: invalid JSON from ${url}`);
    assert.fail('client-config refresh: response body must be JSON');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('ok' in parsed) ||
    (parsed as { ok?: unknown }).ok !== true
  ) {
    fail(
      'Client config refresh',
      `expected { ok: true }, got ${JSON.stringify(parsed).slice(0, 200)} (${elapsedStr})`
    );
    platform.error(`client-config refresh: unexpected JSON from ${url}`);
    assert.fail('client-config refresh: expected { ok: true }');
  }

  ok(
    'Client config refresh',
    `HTTP ${res.status} — ${elapsedStr} — PatchDB updated if needed`
  );
  platform.notice(
    `client-config refresh: POST ${url} succeeded (${elapsedStr}).`
  );
}
