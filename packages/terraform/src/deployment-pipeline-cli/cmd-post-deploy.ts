import { assert } from '@gamezilla/shared/assert';
import { BasePipelineCommand } from './base-command';
import { readTfOutputs, requireOutput, type TfOutputs } from './tf-outputs';
import type { CiPlatform } from './ci-platform';
import { runStep } from './ci-platform';
import { checkInfrastructureHealth } from './infrastructure-health';
import { requireAwsRegion } from './aws';

const DNS_DOMAINS = [
  { domain: 'gamezilla.app', outputKey: 'route53_nameservers' },
] as const;

type HttpEndpointCheck = {
  readonly label: string;
  readonly outputKey: string;
  readonly probePath?: string;
};

const HTTP_ENDPOINTS: readonly HttpEndpointCheck[] = [
  { label: 'WebApp', outputKey: 'web_app_url' },
  { label: 'ReqRes', outputKey: 'req_res_url', probePath: '/health' },
];

const HTTP_TIMEOUT_MS = 30_000;

function parsePositiveIntMsEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

const POST_DEPLOY_HTTP_MAX_WAIT_MS = parsePositiveIntMsEnv('POST_DEPLOY_HTTP_MAX_WAIT_MS', 10 * 60 * 1000);
const POST_DEPLOY_HTTP_RETRY_MS = parsePositiveIntMsEnv('POST_DEPLOY_HTTP_RETRY_MS', 10_000);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpStatusShouldRetry(status: number): boolean {
  return status === 429 || status >= 500;
}

function fmtElapsed(ms: number): string {
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  const s = Math.round(ms / 1_000);
  if (s < 120) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60}s`;
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
  opts: { step: number; total: number; label: string; rawUrl: string; probePath?: string }
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
        platform.error(`${opts.label} ${url} — unreachable after ${elapsedStr}: ${msg}`);
        assert.fail(`post-deploy: ${opts.label} unreachable at ${url}`);
      }
      platform.notice(`Waiting for ${opts.label} — attempt ${attempt}, ${elapsedStr} elapsed (max ${maxWaitStr}): ${msg}`);
      await sleep(POST_DEPLOY_HTTP_RETRY_MS);
      continue;
    }

    if (response.ok) {
      platform.notice(`POST-DEPLOY ${opts.step}/${opts.total}: ${opts.label} ${url} — HTTP ${response.status} OK (${elapsedStr}).`);
      return;
    }

    if (!httpStatusShouldRetry(response.status)) {
      platform.error(`${opts.label} ${url} — HTTP ${response.status} ${response.statusText}`);
      assert.fail(`post-deploy: ${opts.label} returned HTTP ${response.status}`);
    }

    if (elapsed >= POST_DEPLOY_HTTP_MAX_WAIT_MS) {
      platform.error(`${opts.label} ${url} — still HTTP ${response.status} after ${elapsedStr}`);
      assert.fail(`post-deploy: ${opts.label} still HTTP ${response.status}`);
    }

    platform.notice(`Waiting for ${opts.label} — attempt ${attempt}, HTTP ${response.status}, ${elapsedStr} elapsed`);
    await sleep(POST_DEPLOY_HTTP_RETRY_MS);
  }
}

export async function runHttpSmokeTestsOnly(
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
      })
    );
  }
  platform.notice(`HTTP smoke: all ${total} endpoint checks passed.`);
}

export class PostDeployCommand extends BasePipelineCommand {
  readonly id = 'post-deploy';
  readonly summary = 'Smoke-test live infrastructure — DNS records, HTTP health';

  constructor(platform: CiPlatform) {
    super(platform);
  }

  async execute(argv: string[]): Promise<void> {
    assert.array(argv, 'execute: argv must be an array');
    const outputs = readTfOutputs(this.platform);
    const region = requireAwsRegion(this.platform);

    const infraCheckCount = 1;
    let step = 0;
    const total = infraCheckCount + DNS_DOMAINS.length + HTTP_ENDPOINTS.length;

    step++;
    await runStep(this.platform, `POST-DEPLOY ${step}/${total} — Infrastructure health`, () =>
      checkInfrastructureHealth({ platform: this.platform, region })
    );

    for (const { domain, outputKey } of DNS_DOMAINS) {
      step++;
      await runStep(this.platform, `POST-DEPLOY ${step}/${total} — DNS NS ${domain}`, () =>
        this.checkDns(step, total, domain, outputs, outputKey)
      );
    }

    for (const ep of HTTP_ENDPOINTS) {
      step++;
      await runStep(this.platform, `POST-DEPLOY ${step}/${total} — HTTP ${ep.label}`, () =>
        checkHttpEndpoint(this.platform, {
          step,
          total,
          label: ep.label,
          rawUrl: requireOutput(this.platform, outputs, ep.outputKey),
          probePath: ep.probePath,
        })
      );
    }

    this.platform.notice(`POST-DEPLOY: all ${total} checks passed.`);
  }

  private checkDns(step: number, total: number, domain: string, outputs: TfOutputs, outputKey: string): void {
    const raw = outputs[outputKey];
    if (raw === undefined || raw === '') {
      this.platform.notice(`${domain} NS — skipped (no ${outputKey} output).`);
      return;
    }

    const expected = parseNameservers(raw);
    if (expected.size === 0) {
      this.platform.notice(`${domain} NS — skipped (empty nameservers).`);
      return;
    }

    const result = Bun.spawnSync(['dig', 'NS', domain, '+short'], { stdout: 'pipe', stderr: 'pipe' });
    if (result.exitCode === null) {
      this.platform.warning(`dig NS ${domain} — killed by signal, skipping DNS check.`);
      return;
    }
    if (result.exitCode !== 0) {
      this.platform.warning(`dig NS ${domain} failed (exit ${result.exitCode}) — skipping DNS check. Is "dig" installed?`);
      return;
    }

    const actual = parseNameservers(result.stdout.toString());
    if (actual.size === 0) {
      this.platform.error(`dig NS ${domain} returned no records — delegation not configured.`);
      assert.fail(`post-deploy: ${domain} has no NS records`);
    }

    const missing = [...expected].filter((ns) => !actual.has(ns));
    const extra = [...actual].filter((ns) => !expected.has(ns));

    if (missing.length > 0 || extra.length > 0) {
      const parts: string[] = [];
      if (missing.length > 0) parts.push(`missing=[${missing.join(', ')}]`);
      if (extra.length > 0) parts.push(`unexpected=[${extra.join(', ')}]`);
      this.platform.error(`${domain} NS mismatch: ${parts.join('; ')}`);
      assert.fail(`post-deploy: ${domain} NS records do not match`);
    }

    this.platform.notice(`${domain} NS — ${actual.size} records match.`);
  }
}

function parseNameservers(raw: string): Set<string> {
  const entries = raw
    .split(/[\n,]+/)
    .map((s) => s.trim().toLowerCase().replace(/\.$/, ''))
    .filter((s) => s.length > 0);
  return new Set(entries);
}
