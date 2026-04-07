import { assert } from '@gamezilla/shared/assert';
import { PROJECT_CONFIG } from '../../project-config';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import { runSafe } from '../subprocess';
import { fmtElapsed, ok, warn } from './fmt';
import { requireOutput, type TfOutputs } from './tf-outputs';

type HttpEndpointCheck = {
  readonly label: string;
  readonly url: string;
  readonly probePath?: string;
  readonly gatewayCheck?: boolean;
};

function isGatewayError(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

const HTTP_ENDPOINTS: readonly HttpEndpointCheck[] = [
  { label: 'Client', url: `https://www.${PROJECT_CONFIG.domain}` },
  {
    label: 'API /health',
    url: `https://api.${PROJECT_CONFIG.domain}`,
    probePath: '/health',
  },
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
        `Waiting for ${opts.label} ${url} — attempt ${attempt}, ${elapsedStr} elapsed (max ${maxWaitStr}): ${msg}`
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
      assert.fail(`smoke-test: ${opts.label} returned HTTP ${response.status}`);
    }

    if (elapsed >= POST_DEPLOY_HTTP_MAX_WAIT_MS) {
      platform.error(
        `${opts.label} ${url} — still HTTP ${response.status} after ${elapsedStr}`
      );
      assert.fail(`smoke-test: ${opts.label} still HTTP ${response.status}`);
    }

    platform.notice(
      `Waiting for ${opts.label} ${url} — attempt ${attempt}, HTTP ${response.status}, ${elapsedStr} elapsed`
    );
    await sleep(POST_DEPLOY_HTTP_RETRY_MS);
  }
}

function digQuery(host: string, type: string, server?: string): string[] {
  const args = ['+short', host, type];
  if (server) args.push(`@${server}`);
  const r = runSafe('dig', args);
  if (r.exitCode !== 0) return [];
  return r.stdout
    .split('\n')
    .map((l) => l.trim().replace(/\.+$/, ''))
    .filter(Boolean);
}

function checkDns(platform: CiPlatform, outputs: TfOutputs): void {
  const domain = PROJECT_CONFIG.domain;

  const expectedNs = requireOutput(platform, outputs, 'cloudflare_nameservers')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .sort();
  const actualNs = digQuery(domain, 'NS')
    .map((s) => s.toLowerCase())
    .sort();

  if (actualNs.length === 0) {
    warn(
      'DNS nameservers',
      `dig NS ${domain} returned nothing — domain may not be delegated yet`
    );
  } else if (expectedNs.every((ns) => actualNs.includes(ns))) {
    ok('DNS nameservers', actualNs.join(', '));
  } else {
    warn(
      'DNS nameservers',
      `expected [${expectedNs.join(', ')}] but got [${actualNs.join(', ')}] — ` +
        'update nameservers at your registrar'
    );
  }

  const authNs = expectedNs[0];

  for (const sub of ['www', 'api']) {
    const host = `${sub}.${domain}`;

    const localA = digQuery(host, 'A');
    const localAAAA = digQuery(host, 'AAAA');
    const localRecords = [...localA, ...localAAAA];

    const authA = digQuery(host, 'A', authNs);
    const authAAAA = digQuery(host, 'AAAA', authNs);
    const authRecords = [...authA, ...authAAAA];

    if (localRecords.length > 0) {
      ok(`DNS ${host}`, localRecords.join(', '));
    } else if (authRecords.length > 0) {
      warn(
        `DNS ${host}`,
        `local resolver has no records, but authoritative NS (${authNs}) returns [${authRecords.join(', ')}] — ` +
          'DNS propagation pending, try flushing local DNS cache'
      );
    } else {
      warn(
        `DNS ${host}`,
        'no records at local resolver or authoritative NS — check Cloudflare dashboard'
      );
    }
  }
}

export async function runHttpSmokeTests(
  platform: CiPlatform,
  outputs: TfOutputs
): Promise<void> {
  await runStep(platform, 'DNS diagnostics', () => checkDns(platform, outputs));

  let step = 0;
  const total = HTTP_ENDPOINTS.length;
  for (const ep of HTTP_ENDPOINTS) {
    step++;
    await runStep(platform, `HTTP smoke ${step}/${total} — ${ep.label}`, () =>
      checkHttpEndpoint(platform, {
        step,
        total,
        label: ep.label,
        rawUrl: ep.url,
        probePath: ep.probePath,
        gatewayCheck: ep.gatewayCheck,
      })
    );
  }
  platform.notice(`HTTP smoke: all ${total} endpoint checks passed.`);
}
