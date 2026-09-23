/**
 * Harness stand-in for the OAuth popup: E2E web bundles POST the Dev IdP
 * authorization URL here and the harness completes the chooser for the actor
 * that sent it (`x-sim-actor`) and echoes the subject for the signup
 * username. Shared by the `localhost:mocked` listener and the full-system
 * `localhost` web server.
 */

import { createInProcessOpenAuthSession } from '@pkgs/auth/client';
import type { HttpFetch } from '@pkgs/http-client';

export const DEV_AUTH_SESSION_PATH = '/api/__sim/auth-session';

export function isDevAuthSessionRequest(req: Request): boolean {
  return (
    req.method === 'POST' && new URL(req.url).pathname === DEV_AUTH_SESSION_PATH
  );
}

export async function completeDevAuthSession(
  req: Request,
  fetch: HttpFetch,
  subject: string
): Promise<Response> {
  const body: unknown = await req.json();
  if (
    body === null ||
    typeof body !== 'object' ||
    !('authorizationUrl' in body) ||
    !('callbackUrl' in body) ||
    typeof body.authorizationUrl !== 'string' ||
    typeof body.callbackUrl !== 'string'
  ) {
    return new Response('invalid auth session request', { status: 400 });
  }
  const complete = createInProcessOpenAuthSession({ fetch, subject });
  const result = await complete(body.authorizationUrl, body.callbackUrl);
  // The subject doubles as the actor's signup username (as in-process).
  return Response.json(
    result.type === 'success' ? { ...result, subject } : result
  );
}
