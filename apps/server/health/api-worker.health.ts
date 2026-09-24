// @io-wall-ok — live health probe (production API Worker, DNS, TLS).
import { describe, expect, test } from 'bun:test';
import { resolve4, resolve6 } from 'node:dns/promises';
import { connect } from 'node:tls';
import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import {
  productionApiOrigin,
  productionClientOrigin,
} from '@libs/secrets/shared/deploy-origins';
import { waitForHttp } from '@libs/secrets/shared/wait-for-http';
import { wallClock } from '@pkgs/clock';
import { isProductionSecretsEnv } from '@pkgs/secrets-config/deploy-mode';

/** Right after a deploy the custom domain may still be warming up. */
const WARMUP_MS = 5 * 60 * 1000;
const MIN_CERT_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const domain = PRODUCT_CONFIG.domain;
const HOSTS = [
  domain,
  `www.${domain}`,
  `api.${domain}`,
  PRODUCT_CONFIG.emqx.hostname,
] as const;

async function addresses(host: string): Promise<string[]> {
  const settled = await Promise.allSettled([resolve4(host), resolve6(host)]);
  return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

function certificateValidTo(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port: 443, servername: host }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      resolve(Date.parse(cert.valid_to));
    });
    socket.setTimeout(15_000, () => {
      socket.destroy();
      reject(new Error(`TLS handshake with ${host} timed out`));
    });
    socket.on('error', reject);
  });
}

/** `application/health+json` body of `/api/health/ready`. */
type ReadinessJson = {
  readonly status?: string;
  readonly checks?: Record<
    string,
    readonly { readonly status?: string; readonly output?: string }[]
  >;
};

/** `name: output` for every readiness check that did not pass. */
function failingChecks(body: ReadinessJson): string[] {
  const failing: string[] = [];
  for (const [name, results] of Object.entries(body.checks ?? {})) {
    for (const check of results) {
      if (check.status !== 'pass') {
        failing.push(`${name}: ${check.output ?? check.status}`);
      }
    }
  }
  return failing;
}

describe.skipIf(!isProductionSecretsEnv())('api worker (prd)', () => {
  for (const host of HOSTS) {
    test(`DNS resolves ${host}`, async () => {
      expect(await addresses(host)).not.toEqual([]);
    });

    test(`TLS certificate for ${host} is valid for ${String(MIN_CERT_DAYS)}+ days`, async () => {
      const daysLeft = (await certificateValidTo(host)) - wallClock.now();
      expect(daysLeft / DAY_MS).toBeGreaterThan(MIN_CERT_DAYS);
    });
  }

  test(
    '/api/health answers',
    async () => {
      const result = await waitForHttp(`${productionApiOrigin()}/api/health`, {
        label: 'API /api/health',
        maxWaitMs: WARMUP_MS,
      });
      expect(result.status).toBe(200);
    },
    WARMUP_MS + 30_000
  );

  test(
    '/api/health/ready: every hard dependency passes (health+json)',
    async () => {
      const result = await waitForHttp(
        `${productionApiOrigin()}/api/health/ready`,
        { label: 'API /api/health/ready', maxWaitMs: WARMUP_MS }
      );
      const body = JSON.parse(result.body ?? '{}') as ReadinessJson;
      expect(failingChecks(body), 'failing readiness checks').toEqual([]);
      expect(result.status).toBe(200);
      expect(body.status).toBe('pass');
    },
    WARMUP_MS + 30_000
  );

  test(
    'Worker booted: Google OAuth launch redirects with the API callback',
    async () => {
      const api = productionApiOrigin();
      const callbackUrl = `${productionClientOrigin()}/sso-callback`;
      const launch = `${api}/api/auth/oauth/launch?provider=google&callbackUrl=${encodeURIComponent(callbackUrl)}`;
      const result = await waitForHttp(launch, {
        label: 'Google OAuth launch',
        maxWaitMs: WARMUP_MS,
        // 404 = Google disabled, 400 = www untrusted, 503 = worker misconfigured:
        // all are final answers, not warmup.
        accept: (r) =>
          r.status !== undefined &&
          r.status > 0 &&
          r.status !== 502 &&
          r.status !== 504,
      });
      expect(result.body ?? '', 'API returned an error body').not.toContain(
        'api misconfigured'
      );
      expect(result.status).toBe(302);
      const authorize = new URL(result.location ?? '');
      expect(authorize.hostname).toBe('accounts.google.com');
      expect(authorize.searchParams.get('redirect_uri')).toBe(
        `${api}/api/auth/callback/google`
      );
    },
    WARMUP_MS + 30_000
  );
});
