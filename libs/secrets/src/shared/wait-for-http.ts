import { assert } from '@pkgs/assert';
import { createLogger } from '@pkgs/logger';
import { cliClock, cliTimers } from './cli-io';
import { fmtElapsed } from './fmt';
import { httpProbe } from './http-probe';

const log = createLogger({ name: 'secrets:wait-for-http', now: cliClock.now });

const DEFAULT_MAX_WAIT_MS = 5 * 60 * 1000;
const DEFAULT_RETRY_MS = 5_000;
const DEFAULT_PROBE_TIMEOUT_MS = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => cliTimers.setTimeout(resolve, ms));
}

function isProbeHealthy(
  result: Awaited<ReturnType<typeof httpProbe>>
): boolean {
  const status = result.status;
  return result.ok && status !== undefined && status > 0;
}

/** Poll until `rawUrl` returns a successful HTTP status (post-deploy custom domain warmup). */
export async function waitForHttp(
  rawUrl: string,
  opts: {
    label?: string;
    maxWaitMs?: number;
    retryMs?: number;
    probeTimeoutMs?: number;
  } = {}
): Promise<void> {
  const label = opts.label ?? rawUrl;
  const maxWaitMs = opts.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const retryMs = opts.retryMs ?? DEFAULT_RETRY_MS;
  const probeTimeoutMs = opts.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const started = cliClock.now();
  const maxWaitStr = fmtElapsed(maxWaitMs);
  const maxAttempts = Math.ceil(maxWaitMs / retryMs);

  for (let attempt = 1; ; attempt++) {
    const elapsed = cliClock.now() - started;
    const elapsedStr = fmtElapsed(elapsed);
    const result = await httpProbe(rawUrl, probeTimeoutMs);

    if (isProbeHealthy(result)) {
      log.info(
        `${label} ${rawUrl} — HTTP ${result.status} OK (${elapsedStr}).`
      );
      return;
    }

    if (elapsed >= maxWaitMs) {
      const detail =
        result.error ??
        (result.status === undefined
          ? 'no HTTP status'
          : `HTTP ${String(result.status)}`);
      assert.fail(
        `${label} not healthy at ${rawUrl} after ${elapsedStr}: ${detail}`
      );
    }

    const detail =
      result.error ??
      (result.status === undefined
        ? 'no HTTP status'
        : `HTTP ${String(result.status)}`);
    log.info(
      `Waiting for ${label} ${rawUrl} — attempt ${attempt}/${maxAttempts}, ${detail}, ${elapsedStr} elapsed (max ${maxWaitStr})`
    );
    await sleep(retryMs);
  }
}
