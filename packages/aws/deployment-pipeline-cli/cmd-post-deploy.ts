import { assert } from '@gamezilla/shared/assert';
import { BasePipelineCommand } from './base-command';
import {
  readCdkOutputs,
  requireOutput,
  type StackOutputs,
} from './cdk-outputs';
import type { CiPlatform } from './ci-platform';

const DNS_DOMAINS = [
  { domain: 'gamezilla.app', outputKey: 'Route53Nameservers' },
  { domain: 'patchdb.dev', outputKey: 'PatchDbNameservers' },
] as const;

type HttpEndpointCheck = {
  readonly label: string;
  readonly outputKey: string;
  /** If set, GET this path on the base URL (App Runner sync API has no document at `/`). */
  readonly probePath?: string;
};

const HTTP_ENDPOINTS: readonly HttpEndpointCheck[] = [
  { label: 'WebApp', outputKey: 'WebAppUrl' },
  { label: 'PatchDbApp', outputKey: 'PatchDbAppUrl' },
  { label: 'ServerReqRes', outputKey: 'ServerReqResUrl', probePath: '/health' },
];

const HTTP_TIMEOUT_MS = 30_000;

/** App Runner outputs are host-only; fetch() needs an absolute URL. */
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

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    platform.error(`${opts.label} ${url} — fetch failed: ${msg}`);
    assert.fail(`post-deploy: ${opts.label} unreachable at ${url}`);
  }

  if (!response.ok) {
    platform.error(
      `${opts.label} ${url} — HTTP ${response.status} ${response.statusText}`
    );
    assert.fail(`post-deploy: ${opts.label} returned HTTP ${response.status}`);
  }

  assert.ok(response.ok, 'checkHttp: response must be ok');
  platform.notice(
    `POST-DEPLOY ${opts.step}/${opts.total}: ${opts.label} ${url} — HTTP ${response.status} OK.`
  );
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
    await checkHttpEndpointForPostDeploy(platform, {
      step,
      total,
      label: ep.label,
      rawUrl: requireOutput(platform, outputs, ep.outputKey),
      probePath: ep.probePath,
    });
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

    let step = 0;
    const total = DNS_DOMAINS.length + HTTP_ENDPOINTS.length;
    assert.ok(total > 0, 'execute: must have at least one check');

    for (const { domain, outputKey } of DNS_DOMAINS) {
      step++;
      this.checkDns(step, total, domain, outputs, outputKey);
    }

    for (const ep of HTTP_ENDPOINTS) {
      step++;
      await checkHttpEndpointForPostDeploy(this.platform, {
        step,
        total,
        label: ep.label,
        rawUrl: requireOutput(this.platform, outputs, ep.outputKey),
        probePath: ep.probePath,
      });
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
        `POST-DEPLOY ${step}/${total}: ${domain} NS — skipped (no ${outputKey} output).`
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
      assert.fail(`post-deploy: ${domain} NS records do not match Route53`);
    }

    assert.ok(
      missing.length === 0 && extra.length === 0,
      'checkDns: no NS mismatches'
    );
    this.platform.notice(
      `POST-DEPLOY ${step}/${total}: ${domain} NS — ${actual.size} records match Route53.`
    );
  }
}

function parseNameservers(raw: string): Set<string> {
  assert.string(raw, 'parseNameservers: raw must be a string');
  const entries = raw
    .split(/[\n,]+/)
    .map((s) => s.trim().toLowerCase().replace(/\.$/, ''))
    .filter((s) => s.length > 0);
  const set = new Set(entries);
  assert.equals(
    set.size,
    entries.length,
    'parseNameservers: duplicate entries in input'
  );
  return set;
}
