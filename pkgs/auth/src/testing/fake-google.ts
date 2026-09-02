import type { HttpClient } from '@pkgs/http-client';
import { GOOGLE_OAUTH_TOKEN_URL } from '../shared/auth-constants';

const JSON_HEADERS = { 'content-type': 'application/json' };

export type FakeGoogleHttpState = {
  googleFault: boolean;
  googleSubjects: Map<string, string>;
};

function readAuthorization(headers: HeadersInit | undefined): string {
  if (headers instanceof Headers) return headers.get('authorization') ?? '';
  if (headers === undefined || typeof headers !== 'object') return '';
  const rec = headers as Record<string, string>;
  return rec['authorization'] ?? rec['Authorization'] ?? '';
}

function tokenResponse(body: BodyInit | null | undefined): Response {
  const params = new URLSearchParams(typeof body === 'string' ? body : '');
  const code = params.get('code') ?? '';
  return new Response(
    JSON.stringify({
      access_token: `access-${code}`,
      refresh_token: `refresh-${code}`,
      token_type: 'Bearer',
    }),
    { status: 200, headers: JSON_HEADERS }
  );
}

function userinfoResponse(
  system: FakeGoogleHttpState,
  authorization: string
): Response {
  const code = authorization.replace(/^Bearer\s+access-/i, '');
  const sub = system.googleSubjects.get(code) ?? `sub-${code}`;
  return new Response(
    JSON.stringify({
      sub,
      email: `${sub}@gmail.test`,
      name: sub,
      picture: null,
    }),
    { status: 200, headers: JSON_HEADERS }
  );
}

/**
 * Deterministic in-process Google IdP. Reads `googleFault` off the live system
 * bag so the fault library action toggles it mid-run.
 */
export function createFakeGoogleHttp(system: FakeGoogleHttpState): HttpClient {
  return {
    async fetch(input, init) {
      const url = String(input);
      if (system.googleFault) throw new Error('google http fault');
      if (url === GOOGLE_OAUTH_TOKEN_URL) return tokenResponse(init?.body);
      if (url.includes('userinfo')) {
        return userinfoResponse(system, readAuthorization(init?.headers));
      }
      return new Response('not found', { status: 404 });
    },
  };
}
