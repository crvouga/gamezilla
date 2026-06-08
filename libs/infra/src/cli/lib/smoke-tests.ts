import { Resolver, resolve4, resolve6, resolveNs } from 'node:dns/promises';
import { assert } from '@pkgs/assert';
import { PROJECT_CONFIG } from '../../project-config';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import { fmtElapsed, ok, warn } from './fmt';
import { httpProbe } from './http-probe';
import type { InfraOutputs } from './infra-outputs';

type HttpEndpointCheck = {
  readonly label: string;
  readonly url: string;
  readonly probePath?: string;
  readonly gatewayCheck?: boolean;
  readonly fallbackUrl?: string;
  readonly fallbackLabel?: string;
};

function isGatewayError(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

function httpEndpoints(outputs: InfraOutputs): readonly HttpEndpointCheck[] {
  return [
    {
      label: 'Client',
      url: outputs.client_url,
    },
    {
      label: 'API /health',
      url: outputs.api_url,
      probePath: '/health',
    },
  ];
}

function parsePositiveIntMsEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

const POST_DEPLOY_HTTP_MAX_WAIT_MS = parsePositiveIntMsEnv(
  'POST_DEPLOY_HTTP_MAX_WAIT_MS',
  5 * 60 * 1000
);
const POST_DEPLOY_HTTP_RETRY_MS = parsePositiveIntMsEnv(
  'POST_DEPLOY_HTTP_RETRY_MS',
  5_000
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientHttpStatus(status: number): boolean {
  if (status === 429) return true;
  if (status >= 500) return true;
  // Cloudflare Pages returns 409 while a custom domain is activating.
  // 408 and 421 can appear when TLS/routing hasn't propagated yet.
  if (status === 408 || status === 409 || status === 421) return true;
  return false;
}

/**
 * The API Worker returns a structured 503 when it latches into a permanent
 * fatal state (e.g. Vault misconfiguration). This will never self-heal, so
 * retrying only wastes the full timeout budget. Detect it early and fail fast.
 */
function isFatalApiMisconfiguration(result: {
  status?: number;
  body?: string;
}): boolean {
  if (result.status !== 503) return false;
  if (!result.body) return false;
  try {
    const parsed: unknown = JSON.parse(result.body);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      (parsed as Record<string, unknown>)['error'] === 'api misconfigured'
    ) {
      return true;
    }
  } catch {
    /* not JSON or wrong shape — not the fatal response */
  }
  return false;
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

function normalizeDnsLabel(s: string): string {
  return s.trim().toLowerCase().replace(/\.+$/, '');
}

/** Resolve nameserver hostname to an IP for `dns.Resolver.setServers` (requires IPs). */
async function resolveNsHostToIp(nsHost: string): Promise<string | undefined> {
  try {
    const a = await resolve4(nsHost);
    return a[0];
  } catch {
    try {
      const aaaa = await resolve6(nsHost);
      return aaaa[0];
    } catch {
      return undefined;
    }
  }
}

async function lookupAaaa(host: string): Promise<string[]> {
  try {
    return await resolve6(host);
  } catch {
    return [];
  }
}

/** Records from the system / default resolver (same idea as `dig` without @server). */
async function lookupViaDefaultResolver(host: string): Promise<string[]> {
  const a: string[] = [];
  try {
    a.push(...(await resolve4(host)));
  } catch {
    /* empty */
  }
  a.push(...(await lookupAaaa(host)));
  return a;
}

/** Query A/AAAA at a specific authoritative nameserver (by hostname). */
async function lookupViaAuthNs(
  host: string,
  authNsHostname: string
): Promise<string[]> {
  const ip = await resolveNsHostToIp(authNsHostname);
  if (!ip) return [];

  const resolver = new Resolver();
  resolver.setServers([ip]);
  const out: string[] = [];
  try {
    out.push(...(await resolver.resolve4(host)));
  } catch {
    /* empty */
  }
  try {
    out.push(...(await resolver.resolve6(host)));
  } catch {
    /* empty */
  }
  return out;
}

async function checkDns(outputs: InfraOutputs): Promise<void> {
  const domain = PROJECT_CONFIG.domain;

  const expectedNs = outputs.cloudflare_nameservers
    .split(',')
    .map((s) => normalizeDnsLabel(s))
    .filter(Boolean)
    .sort();

  let actualNs: string[] = [];
  try {
    actualNs = (await resolveNs(domain))
      .map((s) => normalizeDnsLabel(s))
      .sort();
  } catch {
    actualNs = [];
  }

  if (actualNs.length === 0) {
    warn(
      'DNS nameservers',
      `NS lookup for ${domain} returned nothing — domain may not be delegated yet`
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
  if (!authNs) {
    warn(
      'DNS checks',
      'no expected nameservers in infra outputs — skipping host checks'
    );
    return;
  }

  for (const sub of ['www', 'api']) {
    const host = `${sub}.${domain}`;

    const localRecords = await lookupViaDefaultResolver(host);
    const authRecords = await lookupViaAuthNs(host, authNs);

    if (localRecords.length > 0) {
      ok(`DNS ${host}`, localRecords.join(', '));
    } else if (authRecords.length > 0) {
      warn(
        `DNS ${host}`,
        `default resolver has no records, but authoritative NS (${authNs}) returns [${authRecords.join(', ')}] — ` +
          'DNS propagation may still be pending'
      );
    } else {
      warn(
        `DNS ${host}`,
        'no records at default resolver or authoritative NS — check Cloudflare dashboard'
      );
    }
  }
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
    fallbackRawUrl?: string;
    fallbackLabel?: string;
  }
): Promise<void> {
  const url = probeUrl(opts.rawUrl, opts.probePath);
  const fallbackUrl = opts.fallbackRawUrl
    ? probeUrl(opts.fallbackRawUrl, opts.probePath)
    : undefined;
  const started = Date.now();
  const maxWaitStr = fmtElapsed(POST_DEPLOY_HTTP_MAX_WAIT_MS);
  const maxAttempts = Math.ceil(
    POST_DEPLOY_HTTP_MAX_WAIT_MS / POST_DEPLOY_HTTP_RETRY_MS
  );

  for (let attempt = 1; ; attempt++) {
    const elapsed = Date.now() - started;
    const elapsedStr = fmtElapsed(elapsed);

    const result = await httpProbe(url);

    if (fallbackUrl && result.status === 0) {
      const fallback = await httpProbe(fallbackUrl);
      if (fallback.ok) {
        platform.notice(
          `Smoke ${opts.step}/${opts.total}: ${opts.label} ${url} unreachable, but ${opts.fallbackLabel ?? 'fallback'} ${fallbackUrl} is healthy (HTTP ${fallback.status}, ${elapsedStr}).`
        );
        return;
      }
    }

    if (result.status === 0) {
      if (elapsed >= POST_DEPLOY_HTTP_MAX_WAIT_MS) {
        platform.error(
          `${opts.label} ${url} — unreachable after ${elapsedStr}: ${result.error}`
        );
        assert.fail(`smoke-test: ${opts.label} unreachable at ${url}`);
      }
      platform.notice(
        `Waiting for ${opts.label} ${url} — attempt ${attempt}/${maxAttempts}, ${elapsedStr} elapsed (max ${maxWaitStr}): ${result.error}`
      );
      await sleep(POST_DEPLOY_HTTP_RETRY_MS);
      continue;
    }

    const acceptable = opts.gatewayCheck
      ? !isGatewayError(result.status ?? 0)
      : result.ok;

    if (acceptable) {
      platform.notice(
        `Smoke ${opts.step}/${opts.total}: ${opts.label} ${url} — HTTP ${result.status} OK (${elapsedStr}).`
      );
      return;
    }

    if (isFatalApiMisconfiguration(result)) {
      let reason = '(unknown)';
      try {
        const parsed = JSON.parse(result.body ?? '{}') as Record<
          string,
          unknown
        >;
        if (typeof parsed['reason'] === 'string') reason = parsed['reason'];
      } catch {
        /* best-effort */
      }
      platform.error(
        `${opts.label} ${url} — FATAL: API misconfigured (${reason}). ` +
          `This is a permanent config error that will not self-heal. ` +
          `Fix the Worker's Vault secrets and re-deploy.`
      );
      assert.fail(
        `smoke-test: ${opts.label} returned fatal "api misconfigured" — reason: ${reason}`
      );
    }

    if (elapsed >= POST_DEPLOY_HTTP_MAX_WAIT_MS) {
      platform.error(
        `${opts.label} ${url} — HTTP ${result.status} after ${elapsedStr}`
      );
      assert.fail(
        `smoke-test: ${opts.label} returned HTTP ${result.status} after ${elapsedStr}`
      );
    }

    const detail = isTransientHttpStatus(result.status ?? 0)
      ? `HTTP ${result.status} (transient, retrying)`
      : `HTTP ${result.status} (unexpected, retrying)`;

    platform.notice(
      `Waiting for ${opts.label} ${url} — attempt ${attempt}/${maxAttempts}, ${detail}, ${elapsedStr} elapsed (max ${maxWaitStr})`
    );
    await sleep(POST_DEPLOY_HTTP_RETRY_MS);
  }
}

export async function runHttpSmokeTests(
  platform: CiPlatform,
  outputs: InfraOutputs
): Promise<void> {
  await runStep(platform, 'DNS diagnostics', () => checkDns(outputs));

  const endpoints = httpEndpoints(outputs);
  let step = 0;
  const total = endpoints.length;
  for (const ep of endpoints) {
    step++;
    await runStep(platform, `HTTP smoke ${step}/${total} — ${ep.label}`, () =>
      checkHttpEndpoint(platform, {
        step,
        total,
        label: ep.label,
        rawUrl: ep.url,
        ...(ep.probePath !== undefined ? { probePath: ep.probePath } : {}),
        ...(ep.gatewayCheck !== undefined
          ? { gatewayCheck: ep.gatewayCheck }
          : {}),
        ...(ep.fallbackUrl !== undefined
          ? { fallbackRawUrl: ep.fallbackUrl }
          : {}),
        ...(ep.fallbackLabel !== undefined
          ? { fallbackLabel: ep.fallbackLabel }
          : {}),
      })
    );
  }

  platform.notice(`HTTP smoke: all checks passed.`);
}
