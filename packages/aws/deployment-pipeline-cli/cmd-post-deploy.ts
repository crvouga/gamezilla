import assert from 'node:assert/strict';
import { BasePipelineCommand } from './base-command';
import {
  readCdkOutputs,
  requireOutput,
  type StackOutputs,
} from './cdk-outputs';
import { reportError, reportNotice } from './ci-platform';

const DNS_DOMAINS = [
  { domain: 'gamezilla.app', outputKey: 'Route53Nameservers' },
  { domain: 'patchdb.dev', outputKey: 'PatchDbNameservers' },
] as const;

const HTTP_ENDPOINTS = [
  { label: 'WebApp', outputKey: 'WebAppUrl' },
  { label: 'PatchDbApp', outputKey: 'PatchDbAppUrl' },
  { label: 'SyncServer', outputKey: 'SyncServerUrl' },
] as const;

const HTTP_TIMEOUT_MS = 30_000;

export class PostDeployCommand extends BasePipelineCommand {
  readonly id = 'post-deploy';
  readonly summary =
    'Smoke-test live infrastructure — DNS records, HTTP health';

  async execute(argv: string[]): Promise<void> {
    assert(Array.isArray(argv));
    const outputs = readCdkOutputs();

    let step = 0;
    const total = DNS_DOMAINS.length + HTTP_ENDPOINTS.length;
    assert(total > 0);

    for (const { domain, outputKey } of DNS_DOMAINS) {
      step++;
      this.checkDns(step, total, domain, outputs, outputKey);
    }

    for (const { label, outputKey } of HTTP_ENDPOINTS) {
      step++;
      await this.checkHttp(
        step,
        total,
        label,
        requireOutput(outputs, outputKey)
      );
    }

    assert.strictEqual(step, total);
    reportNotice(`POST-DEPLOY: all ${total} checks passed.`);
  }

  private checkDns(
    step: number,
    total: number,
    domain: string,
    outputs: StackOutputs,
    outputKey: string
  ): void {
    assert(domain.length > 0);

    const raw = outputs[outputKey];
    if (raw === undefined || raw === '') {
      reportNotice(
        `POST-DEPLOY ${step}/${total}: ${domain} NS — skipped (no ${outputKey} output).`
      );
      return;
    }

    const expected = parseNameservers(raw);
    assert(
      expected.size > 0,
      `${outputKey} must contain at least one nameserver`
    );

    const result = Bun.spawnSync(['dig', 'NS', domain, '+short'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    if (result.exitCode !== 0) {
      const stderr = result.stderr.toString().trim();
      reportError(
        `dig NS ${domain} failed (exit ${result.exitCode}): ${stderr}`
      );
      assert.fail(`post-deploy: dig NS ${domain} failed`);
    }

    assert.strictEqual(result.exitCode, 0);
    const actual = parseNameservers(result.stdout.toString());

    if (actual.size === 0) {
      reportError(
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
      assert(parts.length > 0);
      reportError(
        `${domain} NS mismatch: ${parts.join('; ')}  expected=[${[...expected].join(', ')}]  actual=[${[...actual].join(', ')}]`
      );
      assert.fail(`post-deploy: ${domain} NS records do not match Route53`);
    }

    assert(missing.length === 0 && extra.length === 0);
    reportNotice(
      `POST-DEPLOY ${step}/${total}: ${domain} NS — ${actual.size} records match Route53.`
    );
  }

  private async checkHttp(
    step: number,
    total: number,
    label: string,
    url: string
  ): Promise<void> {
    assert(url.length > 0);
    assert(/^https?:\/\//.test(url), `${label} URL must be http(s)://`);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      reportError(`${label} ${url} — fetch failed: ${msg}`);
      assert.fail(`post-deploy: ${label} unreachable at ${url}`);
    }

    if (!response.ok) {
      reportError(
        `${label} ${url} — HTTP ${response.status} ${response.statusText}`
      );
      assert.fail(`post-deploy: ${label} returned HTTP ${response.status}`);
    }

    assert(response.ok);
    reportNotice(
      `POST-DEPLOY ${step}/${total}: ${label} ${url} — HTTP ${response.status} OK.`
    );
  }
}

function parseNameservers(raw: string): Set<string> {
  assert(typeof raw === 'string');
  const entries = raw
    .split(/[\n,]+/)
    .map((s) => s.trim().toLowerCase().replace(/\.$/, ''))
    .filter((s) => s.length > 0);
  const set = new Set(entries);
  assert(
    set.size === entries.length,
    'parseNameservers: duplicate entries in input'
  );
  return set;
}
