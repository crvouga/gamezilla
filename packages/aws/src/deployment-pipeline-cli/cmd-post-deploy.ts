import { assert } from '@gamezilla/shared/assert';
import { BasePipelineCommand } from './base-command';
import {
  readCdkOutputs,
  requireOutput,
  type StackOutputs,
} from './cdk-outputs';
import type { CiPlatform } from './ci-platform';
import { runStep } from './ci-platform';
import { checkInfrastructureHealth } from './infrastructure-health';
import { requireAwsRegion } from './aws';

const DNS_DOMAINS = [
  { domain: 'gamezilla.app', outputKey: 'Route53Nameservers' },
] as const;

type HttpEndpointCheck = {
  readonly label: string;
  readonly outputKey: string;
  readonly probePath?: string;
};

const HTTP_ENDPOINTS: readonly HttpEndpointCheck[] = [
  { label: 'WebApp', outputKey: 'WebAppUrl' },
  { label: 'ReqRes', outputKey: 'ReqResUrl', probePath: '/health' },
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
  10 * 60 * 1000
);
const POST_DEPLOY_HTTP_RETRY_MS = parsePositiveIntMsEnv(
  'POST_DEPLOY_HTTP_RETRY_MS',
  10_000
);

function sleep(ms: number): Promise<void> {
  assert.ok(ms >= 0, 'sleep: ms must be non-negative');
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

const normalizeUrlForHttpCheck = assert.fn({
  fn(raw: string) {
    const t = raw.trim();
    return /^https?:\/\//.test(t) ? t : `https://${t}`;
  },
  pre(raw) {
    assert.string(raw, 'normalizeUrlForHttpCheck: raw');
    const t = raw.trim();
    assert.ok(t.length > 0, 'URL must be non-empty');
  },
  post(returnValue) {
    assert.string(returnValue, 'normalizeUrlForHttpCheck: returnValue');
    assert.ok(returnValue.length > 0, 'URL must be non-empty');
    assert.ok(/^https?:\/\//.test(returnValue), 'URL must be http(s)://');
  },
});

function probeUrl(rawUrl: string, probePath?: string): string {
  const base = normalizeUrlForHttpCheck(rawUrl);
  if (probePath === undefined || probePath === '') {
    return base;
  }
  const path = probePath.startsWith('/') ? probePath : `/${probePath}`;
  return new URL(path, base.endsWith('/') ? base : `${base}/`).href;
}

async function checkHttpEndpointForPostDeploy(
  platform: CiPlatform,
  opts: {
    step: number;
    total: number;
    label: string;
    rawUrl: string;
    probePath?: string;
  }
): Promise<void> {
  const url = probeUrl(opts.rawUrl, opts.probePath);
  const started = Date.now();
  const maxWaitStr = fmtElapsed(POST_DEPLOY_HTTP_MAX_WAIT_MS);
  let warnedHalfway = false;

  for (let attempt = 1; ; attempt++) {
    const elapsed = Date.now() - started;
    const elapsedStr = fmtElapsed(elapsed);

    if (!warnedHalfway && elapsed >= POST_DEPLOY_HTTP_MAX_WAIT_MS / 2) {
      warnedHalfway = true;
      platform.warning(
        `${opts.label} ${url} — still waiting after ${elapsedStr} (max ${maxWaitStr}). Service may be slow to start.`
      );
    }

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
        platform.error(
          'Fix: Check ECS service events, task logs in CloudWatch, and target group health in the AWS Console.'
        );
        assert.fail(`post-deploy: ${opts.label} unreachable at ${url}`);
      }
      platform.notice(
        `Waiting for ${opts.label} — attempt ${attempt}, ${elapsedStr} elapsed (max ${maxWaitStr}): ${msg}`
      );
      await sleep(POST_DEPLOY_HTTP_RETRY_MS);
      continue;
    }

    if (response.ok) {
      assert.ok(response.ok, 'checkHttp: response must be ok');
      platform.notice(
        `POST-DEPLOY ${opts.step}/${opts.total}: ${opts.label} ${url} — HTTP ${response.status} OK (${elapsedStr}).`
      );
      return;
    }

    const status = response.status;
    if (!httpStatusShouldRetry(status)) {
      platform.error(
        `${opts.label} ${url} — HTTP ${status} ${response.statusText}`
      );
      platform.error(
        `Fix: This is a non-retryable HTTP error. Check the application logs for ${opts.label}.`
      );
      assert.fail(`post-deploy: ${opts.label} returned HTTP ${status}`);
    }

    if (elapsed >= POST_DEPLOY_HTTP_MAX_WAIT_MS) {
      platform.error(
        `${opts.label} ${url} — still HTTP ${status} after ${elapsedStr} (max ${maxWaitStr} exceeded).`
      );
      platform.error(
        'Fix: Check ECS service events, task logs in CloudWatch, and target group health in the AWS Console.'
      );
      assert.fail(`post-deploy: ${opts.label} still HTTP ${status}`);
    }
    platform.notice(
      `Waiting for ${opts.label} — attempt ${attempt}, HTTP ${status}, ${elapsedStr} elapsed (max ${maxWaitStr})`
    );
    await sleep(POST_DEPLOY_HTTP_RETRY_MS);
  }
}

/** HTTP(S) smoke tests only (no DNS NS checks) — used by setup-cli `deploy` during bootstrap. */
export async function runHttpSmokeTestsOnly(
  platform: CiPlatform,
  outputs: StackOutputs
): Promise<void> {
  let step = 0;
  const total = HTTP_ENDPOINTS.length;
  assert.ok(total > 0, 'runHttpSmokeTestsOnly: must have endpoints');

  for (const ep of HTTP_ENDPOINTS) {
    step++;
    await runStep(
      platform,
      `HTTP smoke ${step}/${total} — ${ep.label}`,
      () =>
        checkHttpEndpointForPostDeploy(platform, {
          step,
          total,
          label: ep.label,
          rawUrl: requireOutput(platform, outputs, ep.outputKey),
          probePath: ep.probePath,
        })
    );
  }
  assert.equals(step, total, 'runHttpSmokeTestsOnly: step count');
  platform.notice(`HTTP smoke: all ${total} endpoint checks passed.`);
}

export class PostDeployCommand extends BasePipelineCommand {
  readonly id = 'post-deploy';
  readonly summary =
    'Smoke-test live infrastructure — DNS records, HTTP health';

  constructor(platform: CiPlatform) {
    super(platform);
  }

  async execute(argv: string[]): Promise<void> {
    assert.array(argv, 'execute: argv must be an array');
    const outputs = readCdkOutputs(this.platform);
    const region = requireAwsRegion(this.platform);

    const infraCheckCount = 1;
    let step = 0;
    const total = infraCheckCount + DNS_DOMAINS.length + HTTP_ENDPOINTS.length;
    assert.ok(total > 0, 'execute: must have at least one check');

    step++;
    await runStep(
      this.platform,
      `POST-DEPLOY ${step}/${total} — Infrastructure health`,
      () =>
        checkInfrastructureHealth({
          platform: this.platform,
          region,
        })
    );

    for (const { domain, outputKey } of DNS_DOMAINS) {
      step++;
      await runStep(
        this.platform,
        `POST-DEPLOY ${step}/${total} — DNS NS ${domain}`,
        () => this.checkDns(step, total, domain, outputs, outputKey)
      );
    }

    for (const ep of HTTP_ENDPOINTS) {
      step++;
      await runStep(
        this.platform,
        `POST-DEPLOY ${step}/${total} — HTTP ${ep.label}`,
        () =>
          checkHttpEndpointForPostDeploy(this.platform, {
            step,
            total,
            label: ep.label,
            rawUrl: requireOutput(this.platform, outputs, ep.outputKey),
            probePath: ep.probePath,
          })
      );
    }

    assert.equals(step, total, 'execute: step count must match total');
    this.platform.notice(`POST-DEPLOY: all ${total} checks passed.`);
  }

  private checkDns(
    step: number,
    total: number,
    domain: string,
    outputs: StackOutputs,
    outputKey: string
  ): void {
    assert.ok(domain.length > 0, 'checkDns: domain must be non-empty');

    const raw = outputs[outputKey];
    if (raw === undefined || raw === '') {
      this.platform.notice(
        `${domain} NS — skipped (no ${outputKey} output).`
      );
      return;
    }

    const expected = parseNameservers(raw);
    assert.ok(
      expected.size > 0,
      `${outputKey} must contain at least one nameserver`
    );

    const result = Bun.spawnSync(['dig', 'NS', domain, '+short'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    if (result.exitCode !== 0) {
      const stderr = result.stderr.toString().trim();
      this.platform.error(
        `dig NS ${domain} failed (exit ${result.exitCode}): ${stderr}`
      );
      this.platform.error(
        'Fix: Ensure "dig" is installed (apt-get install dnsutils) and DNS resolution is working.'
      );
      assert.fail(`post-deploy: dig NS ${domain} failed`);
    }

    assert.equals(
      result.exitCode,
      0,
      `checkDns: dig must exit 0 for ${domain}`
    );
    const actual = parseNameservers(result.stdout.toString());

    if (actual.size === 0) {
      this.platform.error(
        `dig NS ${domain} +short returned no records — delegation not configured at registrar.`
      );
      this.platform.error(
        `Fix: Update nameservers at your domain registrar for "${domain}" to match the Route53 hosted zone NS records.`
      );
      assert.fail(`post-deploy: ${domain} has no NS records`);
    }

    const missing = [...expected].filter((ns) => !actual.has(ns));
    const extra = [...actual].filter((ns) => !expected.has(ns));

    if (missing.length > 0 || extra.length > 0) {
      const parts: string[] = [];
      if (missing.length > 0) parts.push(`missing=[${missing.join(', ')}]`);
      if (extra.length > 0) parts.push(`unexpected=[${extra.join(', ')}]`);
      assert.ok(
        parts.length > 0,
        'checkDns: parts must be non-empty on mismatch'
      );
      this.platform.error(
        `${domain} NS mismatch: ${parts.join('; ')}  expected=[${[...expected].join(', ')}]  actual=[${[...actual].join(', ')}]`
      );
      this.platform.error(
        `Fix: Update nameservers at your domain registrar for "${domain}" to match the Route53 hosted zone.`
      );
      assert.fail(`post-deploy: ${domain} NS records do not match Route53`);
    }

    assert.ok(
      missing.length === 0 && extra.length === 0,
      'checkDns: no NS mismatches'
    );
    this.platform.notice(
      `${domain} NS — ${actual.size} records match Route53.`
    );
  }
}

const parseNameservers = assert.fn({
  pre: (raw) => {
    assert.string(raw, 'parseNameservers: raw must be a string');
  },
  post: (returnValue) => {
    assert.all(Array.from(returnValue), (ns) =>
      assert.nonEmptyString(
        ns,
        'parseNameservers: ns must be a non-empty string'
      )
    );
    assert.ok(
      returnValue.size > 0,
      'parseNameservers: returnValue must be non-empty'
    );
  },
  fn: (raw: string): Set<string> => {
    const entries = raw
      .split(/[\n,]+/)
      .map((s) => s.trim().toLowerCase().replace(/\.$/, ''))
      .filter((s) => s.length > 0);
    return new Set(entries);
  },
});
