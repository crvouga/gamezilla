/** Shared fixture: an IdP wired to a virtual clock and a seeded id stream. */

import {
  createGoogleIdpApp,
  createIdpSigningKeys,
  type GoogleIdp,
} from '@pkgs/idp-google-sim/server';
import type { IdpClient } from '@pkgs/idp-google-sim/shared';

export const TEST_CLIENT: IdpClient = {
  clientId: 'test-client.apps.googleusercontent.com',
  clientSecret: 'test-client-secret',
  redirectUris: ['https://app.test/api/auth/callback/google'],
  appName: 'Test App',
};

export type IdpFixture = {
  readonly idp: GoogleIdp;
  /** Advance the virtual clock. */
  advance(ms: number): void;
  /** One browser: keeps cookies and follows nothing automatically. */
  browser(): IdpBrowser;
};

export type IdpBrowser = {
  fetch(input: string, init?: RequestInit): Promise<Response>;
};

export async function createIdpFixture(): Promise<IdpFixture> {
  let nowMs = Date.parse('2024-06-01T00:00:00.000Z');
  let counter = 0;
  const keys = await createIdpSigningKeys();
  const idp = createGoogleIdpApp({
    clock: { now: () => nowMs },
    createId: () => {
      counter += 1;
      return `00000000-0000-4000-8000-${counter.toString().padStart(12, '0')}`;
    },
    keys,
    clients: [TEST_CLIENT],
    accounts: [{ handle: 'alice' }, { handle: 'bob' }],
    issuer: 'https://idp.test',
  });
  return {
    idp,
    advance: (ms) => {
      nowMs += ms;
    },
    browser: () => createBrowser(idp),
  };
}

/** Minimal cookie jar so browser-session behaviour is actually exercised. */
function createBrowser(idp: GoogleIdp): IdpBrowser {
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
  return /name="request_id" value="([^"]+)"/.exec(html)?.[1] ?? '';
}
