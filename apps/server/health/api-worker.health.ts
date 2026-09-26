// @io-wall-ok — live health probe (the environment's API Worker, DNS, TLS).
import { describe, expect, test } from 'bun:test';
import { resolve4, resolve6 } from 'node:dns/promises';
import { connect } from 'node:tls';
import {
  envHostnames,
  envOrigins,
  oauthRelayEnv,
} from '@libs/infra/public/env-file';
import { ENV_FILES, envFile } from '@libs/infra/public/envs';
import { httpProbe } from '@libs/secrets/shared/http-probe';
import { waitForHttp } from '@libs/secrets/shared/wait-for-http';
import { wallClock } from '@pkgs/clock';

/** Right after a deploy the custom domain may still be warming up. */
const WARMUP_MS = 5 * 60 * 1000;
const MIN_CERT_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const env = envFile(process.env['SECRETS_ENV']?.trim() || 'dev');
const origins = envOrigins(env);
const HOSTS = envHostnames(env);
const RELAY = oauthRelayEnv(Object.values(ENV_FILES));
const GOOGLE_CALLBACK_PATH = '/api/auth/callback/google';

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

describe(`api worker (${env.env})`, () => {
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
      const result = await waitForHttp(`${origins.api}/api/health`, {
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
      const result = await waitForHttp(`${origins.api}/api/health/ready`, {
        label: 'API /api/health/ready',
        maxWaitMs: WARMUP_MS,
      });
      const body = JSON.parse(result.body ?? '{}') as ReadinessJson;
      expect(failingChecks(body), 'failing readiness checks').toEqual([]);
      expect(result.status).toBe(200);
      expect(body.status).toBe('pass');
    },
    WARMUP_MS + 30_000
  );

  test(
    'Worker booted: Google OAuth launch redirects with the shared callback',
    async () => {
      const api = origins.api;
      const callbackUrl = `${origins.web}/sso-callback`;
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
        `${envOrigins(RELAY).api}${GOOGLE_CALLBACK_PATH}`
      );
      expect(
        authorize.searchParams.get('state')?.startsWith(`${env.env}.`)
      ).toBe(true);
    },
    WARMUP_MS + 30_000
  );

  // The relay is probed from its own deploy: a replica deploys before the
  // relay learns about it, so its own health must not depend on the relay.
  const others = Object.values(ENV_FILES).filter((o) => o.env !== env.env);
  for (const other of env.env === RELAY.env ? others : []) {
    test(`relays ${other.env}'s Google callbacks to ${other.hosts.api}`, async () => {
      const query = `?state=${other.env}.health&code=health`;
      const result = await httpProbe(
        `${origins.api}${GOOGLE_CALLBACK_PATH}${query}`,
        15_000
      );
      expect(result.status).toBe(302);
      expect(result.location).toBe(
        `${envOrigins(other).api}${GOOGLE_CALLBACK_PATH}${query}`
      );
    });
  }
});
