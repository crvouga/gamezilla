import { STRIPE_CLI_LOG_TAG } from './constants';
import { healthCheckUrl } from './webhook-urls';

const DEFAULT_LOG_INTERVAL_MS = 10_000;

/** Poll until `GET {apiBase}/health` returns 2xx. Blocks indefinitely — turbo `dev` tasks start in parallel. */
export async function waitUntilApiHealthy(
  apiBase: string,
  options?: { logIntervalMs?: number }
): Promise<void> {
  const url = healthCheckUrl(apiBase);
  const logIntervalMs = options?.logIntervalMs ?? DEFAULT_LOG_INTERVAL_MS;
  let lastErr: string | undefined;
  let lastLogAt = 0;

  while (true) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) {
        console.log(`[${STRIPE_CLI_LOG_TAG}] API healthy: ${url}`);
        return;
      }
      lastErr = `HTTP ${String(res.status)}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }

    const now = Date.now();
    if (now - lastLogAt >= logIntervalMs) {
      console.log(
        `[${STRIPE_CLI_LOG_TAG}] Waiting for ${url}… (${lastErr ?? 'unknown'})`
      );
      lastLogAt = now;
    }
    await Bun.sleep(500);
  }
}
