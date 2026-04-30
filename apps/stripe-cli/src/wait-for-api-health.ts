import { STRIPE_CLI_LOG_TAG } from './constants';
import { healthCheckUrl } from './webhook-urls';

/** Poll until `GET {apiBase}/health` returns 2xx or `timeoutMs` elapses. */
export async function exitUnlessApiHealthy(
  apiBase: string,
  timeoutMs: number
): Promise<void> {
  const url = healthCheckUrl(apiBase);
  const deadline = Date.now() + timeoutMs;
  let lastErr: string | undefined;
  while (Date.now() < deadline) {
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
    await Bun.sleep(500);
  }
  console.error(
    `[${STRIPE_CLI_LOG_TAG}] Timed out waiting for ${url} (${String(timeoutMs)}ms). Last error: ${lastErr ?? 'unknown'}. Start @gamezilla/api dev first.`
  );
  process.exit(1);
}
