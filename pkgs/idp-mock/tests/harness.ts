/** Shared fixture: an IdP wired to a virtual clock and a seeded id stream. */

import type { HttpClient } from '@pkgs/http-client';
import {
  createIdpMockApp,
  createIdpSigningKeys,
  defaultAccountsFor,
  type IdpMock,
  IdpStore,
} from '@pkgs/idp-mock/server';
import {
  IDP_AUTHORIZE_CREATE_PATH,
  IDP_AUTHORIZE_SUBMIT_PATH,
  IDP_BOOT_STATE_ELEMENT_ID,
  IDP_PASSWORD,
  IDP_TEST_IDS,
  type IdpAccountDraft,
  type IdpClient,
  type IdpProviderKind,
  type IdpScreenState,
} from '@pkgs/idp-mock/shared';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite/impl-mockingbird-sqlite';

export const TEST_CLIENT: IdpClient = {
  clientId: 'test-client.apps.googleusercontent.com',
  clientSecret: 'test-client-secret',
  redirectUris: ['https://app.test/api/auth/callback/google'],
  appName: 'Test App',
};

/** A clock a test can move, because every TTL here is time-based. */
export type TestClock = {
  now(): number;
  advance(ms: number): void;
};

export function createTestClock(startIso: string): TestClock {
  let nowMs = Date.parse(startIso);
  return {
    now: () => nowMs,
    advance: (ms) => {
      nowMs += ms;
    },
  };
}

/**
 * Deterministic ids: two runs of a scenario mint byte-identical records. A
 * restart that must not reuse the previous run's rows passes its own prefix.
 */
export function createTestIdStream(prefix = ''): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}00000000-0000-4000-8000-${counter.toString().padStart(12, '0')}`;
  };
}

export type IdpFixture = {
  readonly idp: IdpMock;
  readonly store: IdpStore;
  readonly sqlClient: SqlClient;
  readonly clock: TestClock;
  /** Advance the virtual clock. */
  advance(ms: number): void;
  /** One browser: keeps cookies and follows nothing automatically. */
  browser(): IdpBrowser;
  /** Close the database so a durability test can reopen it. */
  close(): Promise<void>;
};

export type IdpBrowser = {
  fetch(input: string, init?: RequestInit): Promise<Response>;
};

export type OpenIdpFixtureArgs = {
  readonly provider?: IdpProviderKind;
  readonly clients?: readonly IdpClient[];
  readonly http?: HttpClient;
  readonly sqlClient: SqlClient;
  readonly clock?: TestClock;
  readonly createId?: () => string;
  readonly accounts?: readonly IdpAccountDraft[];
};

/**
 * Boot a provider over a caller-owned SQLite client. The caller decides
 * durability (`openMemory`, a file) and keeps the client to reopen it later.
 */
export async function openIdpFixture(
  args: OpenIdpFixtureArgs
): Promise<IdpFixture> {
  const clock = args.clock ?? createTestClock('2024-06-01T00:00:00.000Z');
  const createId = args.createId ?? createTestIdStream();
  const provider = args.provider ?? 'google';
  const store = await IdpStore.open({
    provider,
    sqlClient: args.sqlClient,
    clock: { now: () => clock.now() },
    createId,
    createKeys: () => createIdpSigningKeys(),
  });
  const idp = await createIdpMockApp({
    store,
    clients: args.clients ?? [TEST_CLIENT],
    accounts: args.accounts ?? defaultAccountsFor(provider),
    issuer: 'https://idp.test',
    ...(args.http === undefined ? {} : { http: args.http }),
  });
  return {
    idp,
    store,
    sqlClient: args.sqlClient,
    clock,
    advance: clock.advance,
    browser: () => createBrowser(idp),
    close: () => args.sqlClient.disconnect(),
  };
}

/** The common case: an in-memory SQLite database. */
export async function createIdpFixture(
  overrides: Omit<OpenIdpFixtureArgs, 'sqlClient'> = {}
): Promise<IdpFixture> {
  const sqlClient = SqlClientImplMockingbirdSqlite.open({ seed: 1 });
  return await openIdpFixture({ ...overrides, sqlClient });
}

/** Minimal cookie jar so browser-session behaviour is actually exercised. */
function createBrowser(idp: IdpMock): IdpBrowser {
  const cookies = new Map<string, string>();
  return {
    async fetch(input, init) {
      const jar = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
      const headers = new Headers(init?.headers);
      if (jar.length > 0) headers.set('cookie', jar);
      const response = await idp.app.fetch(
        new Request(new URL(input, 'https://idp.test').toString(), {
          ...init,
          headers,
          redirect: 'manual',
        })
      );
      for (const raw of response.headers.getSetCookie()) {
        const [pair] = raw.split(';');
        const at = pair?.indexOf('=') ?? -1;
        if (pair !== undefined && at > 0) {
          cookies.set(pair.slice(0, at), pair.slice(at + 1));
        }
      }
      return response;
    },
  };
}

export function formBody(fields: Record<string, string>): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  };
}

/** Pull the hidden `request_id` out of a rendered IdP page. */
export function requestIdOf(html: string): string {
  return (
    /<input[^>]*name="request_id"[^>]*value="([^"]+)"/.exec(html)?.[1] ?? ''
  );
}

/** The hidden fields of the first form, the way a browser would submit them. */
export function hiddenFieldsOf(html: string): Record<string, string> {
  const form = /<form\b[^>]*>([\s\S]*?)<\/form>/i.exec(html)?.[1] ?? '';
  const out: Record<string, string> = {};
  for (const match of form.matchAll(/<input\b[^>]*>/gi)) {
    const tag = match[0];
    const name = /name="([^"]*)"/.exec(tag)?.[1];
    if (name === undefined) continue;
    out[name] = /value="([^"]*)"/.exec(tag)?.[1] ?? '';
  }
  return out;
}

/** One `/o/oauth2/v2/auth` URL with the fixture client's own redirect URI. */
export function authorizeUrl(overrides: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    client_id: TEST_CLIENT.clientId,
    redirect_uri: TEST_CLIENT.redirectUris[0] ?? '',
    response_type: 'code',
    scope: 'openid email profile',
    state: 'state-123',
    ...overrides,
  });
  return `/o/oauth2/v2/auth?${params.toString()}`;
}

/** Type an address into step 1 and submit. */
export async function submitIdentifier(
  browser: IdpBrowser,
  pageHtml: string,
  email: string
): Promise<Response> {
  return await browser.fetch(
    IDP_AUTHORIZE_SUBMIT_PATH,
    formBody({
      request_id: requestIdOf(pageHtml),
      step: 'identifier',
      email,
    })
  );
}

/** Type the shared local password into step 2 and submit. */
export async function submitPassword(
  browser: IdpBrowser,
  pageHtml: string,
  password: string
): Promise<Response> {
  return await browser.fetch(
    IDP_AUTHORIZE_SUBMIT_PATH,
    formBody({
      request_id: requestIdOf(pageHtml),
      step: 'password',
      password,
    })
  );
}

/** Press "Continue" on the consent card. */
export async function allowConsent(
  browser: IdpBrowser,
  consentHtml: string
): Promise<Response> {
  return await browser.fetch(
    IDP_AUTHORIZE_SUBMIT_PATH,
    formBody({
      request_id: requestIdOf(consentHtml),
      step: 'consent',
      decision: 'allow',
    })
  );
}

/** Walk both sign-in steps and approve whatever consent appears. */
export async function signInWithPassword(
  browser: IdpBrowser,
  url: string,
  email: string
): Promise<Response> {
  const entry = await browser.fetch(url);
  // A known account with an approved grant is bounced straight to the app.
  if (entry.headers.get('location') !== null) return entry;
  const identified = await submitIdentifier(browser, await entry.text(), email);
  if (identified.headers.get('location') !== null) return identified;
  const authed = await submitPassword(
    browser,
    await identified.text(),
    IDP_PASSWORD
  );
  if (authed.headers.get('location') !== null) return authed;
  const body = await authed.text();
  if (body.includes(IDP_TEST_IDS.consentPage)) {
    return await allowConsent(browser, body);
  }
  return authed;
}

/** The boot-state JSON the server writes next to the markup. */
export function screenStateOf(html: string): IdpScreenState {
  const match = new RegExp(
    `<script type="application/json" id="${IDP_BOOT_STATE_ELEMENT_ID}">([\\s\\S]*?)</script>`
  ).exec(html);
  if (match?.[1] === undefined) {
    throw new Error('no boot state in the rendered screen');
  }
  return JSON.parse(match[1]) as IdpScreenState;
}

/** The authorization code out of a success redirect. */
export function codeOf(response: Response): string {
  return (
    new URL(response.headers.get('location') ?? '').searchParams.get('code') ??
    ''
  );
}

export function exchangeBody(args: {
  readonly code: string;
  readonly redirectUri?: string;
  readonly extra?: Record<string, string>;
}): RequestInit {
  return formBody({
    client_id: TEST_CLIENT.clientId,
    client_secret: TEST_CLIENT.clientSecret,
    code: args.code,
    grant_type: 'authorization_code',
    redirect_uri: args.redirectUri ?? TEST_CLIENT.redirectUris[0] ?? '',
    ...args.extra,
  });
}

/** Walk to the create-account screen and submit name + email there. */
export async function createAccountViaScreen(
  browser: IdpBrowser,
  signInHtml: string,
  account: { readonly name: string; readonly email: string }
): Promise<Response> {
  const requestId = requestIdOf(signInHtml);
  const page = await browser.fetch(
    `${IDP_AUTHORIZE_CREATE_PATH}?request_id=${encodeURIComponent(requestId)}`
  );
  if (!(await page.text()).includes(IDP_TEST_IDS.createAccountPage)) {
    throw new Error('create-account screen did not render');
  }
  return await browser.fetch(
    IDP_AUTHORIZE_SUBMIT_PATH,
    formBody({
      request_id: requestId,
      step: 'create',
      name: account.name,
      email: account.email,
    })
  );
}
