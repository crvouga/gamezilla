// @io-wall-ok — live health: the environment's API Worker, DNS and TLS.
/** `specs/runtime/reaching-the-app.feature`, `serving-people.feature` and `specs/auth/sign-in.feature`. */

import { expect } from 'bun:test';
import { resolve4, resolve6 } from 'node:dns/promises';
import { connect } from 'node:tls';
import {
  authRelayOrigin,
  envHostnames,
  envOrigins,
} from '@libs/infra-shared/env-file';
import { ENV_FILES } from '@libs/infra-shared/envs';
import { httpProbe } from '@libs/secrets-server/http-probe';
import { waitForHttp } from '@libs/secrets-server/wait-for-http';
import { wallClock } from '@pkgs/clock-shared/wall';
import { Then, WARMUP_MS, When } from './define';

const DAY_MS = 24 * 60 * 60 * 1000;
const GOOGLE_CALLBACK_PATH = '/api/auth/callback/google';
const SIGN_IN_ANSWER = 'sign-in-answer';

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

Then('people can find the app at every one of its addresses', async (w) => {
  const unresolved: string[] = [];
  for (const host of envHostnames(w.env)) {
    if ((await addresses(host)).length === 0) unresolved.push(host);
  }
  expect(unresolved).toEqual([]);
});

Then(
  'people reach every address of the app securely for {int} more days',
  async (w, minDays: number) => {
    const expiring: string[] = [];
    for (const host of envHostnames(w.env)) {
      const daysLeft =
        ((await certificateValidTo(host)) - wallClock.now()) / DAY_MS;
      if (daysLeft <= minDays) {
        expiring.push(`${host}: ${daysLeft.toFixed(1)} days left`);
      }
    }
    expect(expiring).toEqual([]);
  }
);

Then('the app answers people', async (w) => {
  const result = await waitForHttp(`${w.origins.api}/api/health`, {
    label: 'API /api/health',
    maxWaitMs: WARMUP_MS,
  });
  expect(result.status).toBe(200);
});

Then('everything the app needs to answer people is ready', async (w) => {
  const result = await waitForHttp(`${w.origins.api}/api/health/ready`, {
    label: 'API /api/health/ready',
    maxWaitMs: WARMUP_MS,
  });
  const body = JSON.parse(result.body ?? '{}') as ReadinessJson;
  expect(failingChecks(body), 'failing readiness checks').toEqual([]);
  expect(result.status).toBe(200);
  expect(body.status).toBe('pass');
});

/**
 * A browser on www posts the one-time code to `/api/auth/session`. An unknown
 * code is refused, but the refusal must still be readable cross-origin — a
 * missing `Access-Control-Allow-Origin` silently breaks every sign-in.
 */
When('a person on the web finishes signing in', async (w) => {
  const res = await w.http.fetch(`${w.origins.api}/api/auth/session`, {
    method: 'POST',
    headers: { origin: w.origins.web, 'content-type': 'application/json' },
    body: JSON.stringify({ code: `health-${w.env.env}` }),
  });
  await res.body?.cancel();
  w.memo.set(SIGN_IN_ANSWER, res);
});

Then('the app on the web knows whether they are signed in', (w) => {
  const res = w.memo.get(SIGN_IN_ANSWER) as Response;
  expect(res.status, 'the API did not answer the exchange').toBeLessThan(500);
  expect(res.headers.get('access-control-allow-origin')).toBe(w.origins.web);
  expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  expect(res.headers.get('access-control-expose-headers') ?? '').toContain(
    'set-auth-token'
  );
});

Then(
  'starting a Google sign-in hands the person to Google with the way back to the app',
  async (w) => {
    const callbackUrl = `${w.origins.web}/sso-callback`;
    const launch = `${w.origins.api}/api/auth/oauth/launch?provider=google&callbackUrl=${encodeURIComponent(callbackUrl)}`;
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
      `${authRelayOrigin()}${GOOGLE_CALLBACK_PATH}`
    );
    expect(
      authorize.searchParams.get('state')?.startsWith(`${w.env.env}.`)
    ).toBe(true);
  }
);

/**
 * The relay (`apps/auth-relay`) is global and redeploys in the Deploy
 * workflow's fleet job, before any environment, so every environment can
 * prove it forwards each other environment's callbacks home.
 */
Then(
  'Google sign-ins started in any other environment return to that environment',
  async (w) => {
    const others = Object.values(ENV_FILES).filter((o) => o.env !== w.env.env);
    for (const other of others) {
      const query = `?state=${other.env}.health&code=health`;
      const result = await httpProbe(
        `${authRelayOrigin()}${GOOGLE_CALLBACK_PATH}${query}`,
        15_000
      );
      expect(result.status, `relay to ${other.env}`).toBe(302);
      expect(result.location).toBe(
        `${envOrigins(other).api}${GOOGLE_CALLBACK_PATH}${query}`
      );
    }
  }
);
