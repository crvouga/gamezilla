import { assert } from '@gamezilla/shared/assert';
import { fmtElapsed } from './fmt';
import { requireOutput, type TfOutputs } from './tf-outputs';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';

type HttpEndpointCheck = {
  readonly label: string;
  readonly outputKey: string;
  readonly probePath?: string;
  readonly gatewayCheck?: boolean;
};

function isGatewayError(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

const HTTP_ENDPOINTS: readonly HttpEndpointCheck[] = [
  { label: 'WebApp', outputKey: 'web_app_url' },
  { label: 'API /health', outputKey: 'api_url', probePath: '/health' },
];

const HTTP_TIMEOUT_MS = 30_000;

function parsePositiveIntMsEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

const POST_DEPLOY_HTTP_MAX_WAIT_MS = parsePositiveIntMsEnv(
  'POST_DEPLOY_HTTP_MAX_WAIT_MS',
  2 * 60 * 1000
);
const POST_DEPLOY_HTTP_RETRY_MS = parsePositiveIntMsEnv(
  'POST_DEPLOY_HTTP_RETRY_MS',
  10_000
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpStatusShouldRetry(status: number): boolean {
  return status === 429 || status >= 500;
}

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  return /^https?:\/\//.test(t) ? t : `https://${t}`;
}

function probeUrl(rawUrl: string, probePath?: string): string {
  const base = normalizeUrl(rawUrl);
  if (!probePath) return base;
  const path = probePath.startsWith('/') ? probePath : `/${probePath}`;
  return new URL(path, base.endsWith('/') ? base : `${base}/`).href;
}

async function checkHttpEndpoint(
  platform: CiPlatform,
  opts: {
    step: number;
    total: number;
    label: string;
    rawUrl: string;
    probePath?: string;
    gatewayCheck?: boolean;
  }
): Promise<void> {
  const url = probeUrl(opts.rawUrl, opts.probePath);
  const started = Date.now();
  const maxWaitStr = fmtElapsed(POST_DEPLOY_HTTP_MAX_WAIT_MS);

  for (let attempt = 1; ; attempt++) {
    const elapsed = Date.now() - started;
    const elapsedStr = fmtElapsed(elapsed);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (elapsed >= POST_DEPLOY_HTTP_MAX_WAIT_MS) {
        platform.error(
          `${opts.label} ${url} — unreachable after ${elapsedStr}: ${msg}`
        );
        assert.fail(`smoke-test: ${opts.label} unreachable at ${url}`);
      }
      platform.notice(
        `Waiting for ${opts.label} — attempt ${attempt}, ${elapsedStr} elapsed (max ${maxWaitStr}): ${msg}`
      );
      await sleep(POST_DEPLOY_HTTP_RETRY_MS);
      continue;
    }

    const acceptable = opts.gatewayCheck
      ? !isGatewayError(response.status)
      : response.ok;

    if (acceptable) {
      platform.notice(
        `Smoke ${opts.step}/${opts.total}: ${opts.label} ${url} — HTTP ${response.status} OK (${elapsedStr}).`
      );
      return;
    }

    const shouldRetry = opts.gatewayCheck
      ? isGatewayError(response.status)
      : httpStatusShouldRetry(response.status);

    if (!shouldRetry) {
      platform.error(
        `${opts.label} ${url} — HTTP ${response.status} ${response.statusText}`
      );
      assert.fail(
        `smoke-test: ${opts.label} returned HTTP ${response.status}`
      );
    }

    if (elapsed >= POST_DEPLOY_HTTP_MAX_WAIT_MS) {
      platform.error(
        `${opts.label} ${url} — still HTTP ${response.status} after ${elapsedStr}`
      );
      assert.fail(`smoke-test: ${opts.label} still HTTP ${response.status}`);
    }

    platform.notice(
      `Waiting for ${opts.label} — attempt ${attempt}, HTTP ${response.status}, ${elapsedStr} elapsed`
    );
    await sleep(POST_DEPLOY_HTTP_RETRY_MS);
  }
}

export async function runHttpSmokeTests(
  platform: CiPlatform,
  outputs: TfOutputs
): Promise<void> {
  let step = 0;
  const total = HTTP_ENDPOINTS.length;
  for (const ep of HTTP_ENDPOINTS) {
    step++;
    await runStep(platform, `HTTP smoke ${step}/${total} — ${ep.label}`, () =>
      checkHttpEndpoint(platform, {
        step,
        total,
        label: ep.label,
        rawUrl: requireOutput(platform, outputs, ep.outputKey),
        probePath: ep.probePath,
        gatewayCheck: ep.gatewayCheck,
      })
    );
  }
  platform.notice(`HTTP smoke: all ${total} endpoint checks passed.`);
}
