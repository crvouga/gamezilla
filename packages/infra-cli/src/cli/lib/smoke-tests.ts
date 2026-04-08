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

const CURL_TIMEOUT_S = 30;

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

/**
 * Resolve a hostname to an IP via Cloudflare's public DNS (1.1.1.1),
 * bypassing stale local DNS caches.
 */
function resolveVia1111(hostname: string): string | null {
  const r = runSafe('dig', ['+short', hostname, 'A', '@1.1.1.1']);
  if (r.exitCode !== 0) return null;
  const ip = r.stdout.split('\n').map((l) => l.trim()).find((l) => /^\d+\.\d+\.\d+\.\d+$/.test(l));
  return ip ?? null;
}

/**
 * Use curl with --resolve to force DNS resolution through Cloudflare's
 * 1.1.1.1 resolver, bypassing stale local caches.
 */
function curlStatus(url: string): { ok: boolean; status: number; error?: string } {
  const parsed = new URL(url);
  const hostname = parsed.hostname;
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');

  const ip = resolveVia1111(hostname);

  const args = [
    '-s', '-o', '/dev/null',
    '-w', '%{http_code}',
    '--max-time', String(CURL_TIMEOUT_S),
    '-L',
  ];

  if (ip) {
    args.push('--resolve', `${hostname}:${port}:${ip}`);
  }

  args.push(url);

  const r = runSafe('curl', args);
  if (r.exitCode !== 0) {
    return { ok: false, status: 0, error: r.stderr.trim() || `curl exit ${r.exitCode}` };
  }
  const status = parseInt(r.stdout.trim(), 10);
  if (Number.isNaN(status)) {
    return { ok: false, status: 0, error: `unexpected curl output: ${r.stdout.trim()}` };
  }
  return { ok: status >= 200 && status < 400, status };
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

    const result = curlStatus(url);

    if (result.status === 0) {
      if (elapsed >= POST_DEPLOY_HTTP_MAX_WAIT_MS) {
        platform.error(
          `${opts.label} ${url} — unreachable after ${elapsedStr}: ${result.error}`
        );
        assert.fail(`smoke-test: ${opts.label} unreachable at ${url}`);
      }
      platform.notice(
        `Waiting for ${opts.label} ${url} — attempt ${attempt}, ${elapsedStr} elapsed (max ${maxWaitStr}): ${result.error}`
      );
      await sleep(POST_DEPLOY_HTTP_RETRY_MS);
      continue;
    }

    const acceptable = opts.gatewayCheck
      ? !isGatewayError(result.status)
      : result.ok;

    if (acceptable) {
      platform.notice(
        `Smoke ${opts.step}/${opts.total}: ${opts.label} ${url} — HTTP ${result.status} OK (${elapsedStr}).`
      );
      return;
    }

    const shouldRetry = opts.gatewayCheck
      ? isGatewayError(result.status)
      : httpStatusShouldRetry(result.status);

    if (!shouldRetry) {
      platform.error(
        `${opts.label} ${url} — HTTP ${result.status}`
      );
      assert.fail(`smoke-test: ${opts.label} returned HTTP ${result.status}`);
    }

    if (elapsed >= POST_DEPLOY_HTTP_MAX_WAIT_MS) {
      platform.error(
        `${opts.label} ${url} — still HTTP ${result.status} after ${elapsedStr}`
      );
      assert.fail(`smoke-test: ${opts.label} still HTTP ${result.status}`);
    }

    platform.notice(
      `Waiting for ${opts.label} ${url} — attempt ${attempt}, HTTP ${result.status}, ${elapsedStr} elapsed`
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

async function checkDbSmoke(platform: CiPlatform): Promise<void> {
  const apiUrl = `https://api.${PROJECT_CONFIG.domain}`;
  const url = `${apiUrl}/patch-db/patches/read`;
  const body = JSON.stringify({
    queries: [{ entityType: '__smoke_test__', knownPatches: [] }],
  });

  const started = Date.now();
  for (let attempt = 1; ; attempt++) {
    const elapsed = Date.now() - started;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (res.ok) {
        ok('DB smoke', `POST ${url} — HTTP ${res.status} (${fmtElapsed(elapsed)})`);
        return;
      }

      const text = await res.text().catch(() => '');
      if (!httpStatusShouldRetry(res.status)) {
        assert.fail(
          `DB smoke failed: POST ${url} — HTTP ${res.status}: ${text}`,
        );
      }

      if (elapsed >= POST_DEPLOY_HTTP_MAX_WAIT_MS) {
        assert.fail(
          `DB smoke failed after ${fmtElapsed(elapsed)}: POST ${url} — HTTP ${res.status}: ${text}`,
        );
      }

      platform.notice(
        `DB smoke: attempt ${attempt}, HTTP ${res.status}, retrying… (${fmtElapsed(elapsed)})`,
      );
    } catch (err) {
      if (elapsed >= POST_DEPLOY_HTTP_MAX_WAIT_MS) {
        assert.fail(
          `DB smoke failed after ${fmtElapsed(elapsed)}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      platform.notice(
        `DB smoke: attempt ${attempt}, fetch error, retrying… (${fmtElapsed(elapsed)})`,
      );
    }

    await sleep(POST_DEPLOY_HTTP_RETRY_MS);
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

  await runStep(platform, 'DB smoke — patches/read', () =>
    checkDbSmoke(platform)
  );

  platform.notice(`HTTP smoke: all checks passed.`);
}
