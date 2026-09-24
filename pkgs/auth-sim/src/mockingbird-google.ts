/**
 * Google IdP backed by `@crvouga/mockingbird-service-oauth` (google profile).
 *
 * The mock serves Google's real paths (`/o/oauth2/v2/auth`, `/token`,
 * `/v1/userinfo`), so `@pkgs/auth` keeps its production URLs and only the
 * injected `HttpClient` changes. `approve` drives the mock's chooser + consent
 * forms the way a browser would and returns the redirect back to the app.
 */

import {
  createRuntime,
  type OAuthRuntime,
} from '@crvouga/mockingbird-service-oauth';
import { type Clock, createSettableClock } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';

const INTERACTION_URL = 'https://accounts.google.com/interaction';
const TOKEN_FAULT_ID = 'google-token-fault';
const FORM_HEADERS = { 'content-type': 'application/x-www-form-urlencoded' };

export type MockingbirdGoogle = {
  readonly idp: OAuthRuntime;
  /** Server-side HTTP for `createAuthApp({ http })`. */
  readonly http: HttpClient;
  /**
   * Sign in as `subject` on the authorize URL the app redirected to. Returns
   * the app callback URL (with `code` + `state`), or null when the IdP did not
   * redirect back.
   */
  readonly approve: (
    authorizeUrl: string,
    subject: string
  ) => Promise<string | null>;
  /** Drop token exchanges (network failure) until turned off. */
  readonly setTokenFault: (fault: boolean) => void;
};

function readTransaction(html: string): string | null {
  return /name="transaction" value="([^"]+)"/.exec(html)?.[1] ?? null;
}

async function submitInteraction(
  idp: OAuthRuntime,
  fields: Record<string, string>
): Promise<Response> {
  return idp.fetch(
    new Request(INTERACTION_URL, {
      method: 'POST',
      redirect: 'manual',
      headers: FORM_HEADERS,
      body: new URLSearchParams(fields).toString(),
    })
  );
}

async function approveAs(
  idp: OAuthRuntime,
  authorizeUrl: string,
  subject: string
): Promise<string | null> {
  const chooser = await idp.fetch(
    new Request(authorizeUrl, { redirect: 'manual' })
  );
  const chooserTx = readTransaction(await chooser.text());
  if (chooserTx === null) return null;
  const consent = await submitInteraction(idp, {
    transaction: chooserTx,
    action: 'select',
    account: subject,
  });
  const consentTx = readTransaction(await consent.text());
  if (consentTx === null) return null;
  const redirect = await submitInteraction(idp, {
    transaction: consentTx,
    action: 'allow',
  });
  return redirect.headers.get('location');
}

export function createMockingbirdGoogle(args: {
  readonly clock: Clock;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly subjects: readonly string[];
}): MockingbirdGoogle {
  const idp = createRuntime({
    provider: 'google',
    clock: createSettableClock(args.clock),
    accounts: args.subjects.map((subject) => ({
      id: subject,
      email: `${subject}@gmail.test`,
      name: subject,
    })),
    clients: [
      {
        id: args.clientId,
        name: 'auth-sim',
        secret: args.clientSecret,
        redirectUris: [args.redirectUri],
      },
    ],
  });
  return {
    idp,
    http: {
      fetch: (input, init) => idp.fetch(new Request(input, init)),
    },
    approve: (authorizeUrl, subject) => approveAs(idp, authorizeUrl, subject),
    setTokenFault: (fault) => {
      idp.faults.remove(TOKEN_FAULT_ID);
      if (!fault) return;
      idp.faults.add({ id: TOKEN_FAULT_ID, pathPrefix: '/token', drop: true });
    },
  };
}
