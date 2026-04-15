import { createApiRpcClient } from '@gamezilla/api/rpc';
import { assert } from '@gamezilla/shared/assert';
import type { CiPlatform } from '../platform/platform';
import { fail, fmtElapsed, fmtMs, info, ok, warn } from './fmt';
import type { InfraOutputs } from './infra-outputs';

const MAX_WAIT_MS = 2 * 60 * 1000;
const RETRY_MS = 5_000;

function clientConfigRefreshUrl(apiUrl: string): string {
  const base = apiUrl.replace(/\/+$/, '');
  return `${base}/client-config/refresh`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Bun's fetch emits a wide variety of error messages for connection-level
 * failures ("Unable to connect", "Was there a typo in the url or port?",
 * "ECONNREFUSED", …). Rather than enumerating them all, treat every
 * thrown exception as retryable — the MAX_WAIT_MS ceiling is the real guard.
 */
function isFetchException(_e: unknown): boolean {
  return true;
}

/**
 * POSTs to the API so the Worker writes the latest client runtime config into
 * PatchDB. Run only after smoke tests pass (deploy pipeline step).
 *
 * Retries transient connection errors (DNS propagation, cold-start) for up to
 * MAX_WAIT_MS before failing.
 */
export async function refreshClientConfig(
  platform: CiPlatform,
  outputs: InfraOutputs
): Promise<void> {
  const client = createApiRpcClient(outputs.api_url);
  const url = clientConfigRefreshUrl(outputs.api_url);
  info('Target', url);

  const timeoutMs = 30_000;
  const started = performance.now();
  const maxAttempts = Math.ceil(MAX_WAIT_MS / RETRY_MS);

  for (let attempt = 1; ; attempt++) {
    const t0 = performance.now();

    let res: Response;
    try {
      res = await client['client-config']['refresh'].$post(undefined, {
        init: {
          redirect: 'follow',
          signal: AbortSignal.timeout(timeoutMs),
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        },
      });
    } catch (e) {
      const elapsed = performance.now() - started;
      const elapsedStr = fmtMs(performance.now() - t0);
      const msg = e instanceof Error ? e.message : String(e);

      if (isFetchException(e) && elapsed < MAX_WAIT_MS) {
        warn(
          'Client config refresh',
          `${msg} — attempt ${attempt}/${maxAttempts}, retrying in ${fmtElapsed(RETRY_MS)} (${fmtElapsed(elapsed)} elapsed)`
        );
        await sleep(RETRY_MS);
        continue;
      }

      fail('Client config refresh', `${msg} (${elapsedStr})`);
      platform.error(`client-config refresh: request failed — ${msg} (${url})`);
      assert.fail(`client-config refresh: ${msg}`);
    }

    const elapsed = performance.now() - t0;
    const elapsedStr = fmtMs(elapsed);

    if (!res.ok) {
      const totalElapsed = performance.now() - started;
      const bodyPreview = await res.text().catch(() => '');

      if (res.status >= 500 && totalElapsed < MAX_WAIT_MS) {
        warn(
          'Client config refresh',
          `HTTP ${res.status} — attempt ${attempt}/${maxAttempts}, retrying in ${fmtElapsed(RETRY_MS)} (${fmtElapsed(totalElapsed)} elapsed)`
        );
        await sleep(RETRY_MS);
        continue;
      }

      const detail = bodyPreview ? ` — body: ${bodyPreview.slice(0, 200)}` : '';
      fail(
        'Client config refresh',
        `HTTP ${res.status} from ${url} (${elapsedStr})${detail}`
      );
      platform.error(
        `client-config refresh failed: HTTP ${res.status} ${url} (${elapsedStr})`
      );
      assert.fail(
        `client-config refresh: expected 2xx, got HTTP ${res.status}`
      );
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

    if (attempt > 1) {
      ok(
        'Client config refresh',
        `HTTP ${res.status} — ${elapsedStr} — succeeded after ${attempt} attempts (${fmtElapsed(performance.now() - started)} total)`
      );
    } else {
      ok(
        'Client config refresh',
        `HTTP ${res.status} — ${elapsedStr} — PatchDB updated if needed`
      );
    }
    platform.notice(
      `client-config refresh: POST ${url} succeeded (${elapsedStr}).`
    );
    return;
  }
}
