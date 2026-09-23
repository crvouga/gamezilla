import type { HttpClient } from '@pkgs/http-client';

import {
  APPLE_ISSUER,
  APPLE_OAUTH_AUTHORIZE_URL,
  APPLE_OAUTH_KEYS_URL,
} from '../shared/auth-constants';
import type { AppleProviderConfig } from './create-auth-app-types';

export type AppleUserInfo = {
  readonly sub: string;
  readonly email: string | null;
};

export function buildAppleAuthorizationUrl(args: {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string;
  readonly nonce: string;
}): string {
  const url = new URL(APPLE_OAUTH_AUTHORIZE_URL);
  url.searchParams.set('client_id', args.clientId);
  url.searchParams.set('redirect_uri', args.redirectUri);
  url.searchParams.set('response_type', 'code id_token');
  url.searchParams.set('response_mode', 'form_post');
  url.searchParams.set('scope', 'name email');
  url.searchParams.set('state', args.state);
  url.searchParams.set('nonce', args.nonce);
  return url.toString();
}

function bytesFromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad =
    padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function jsonFromBase64Url(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(
    new TextDecoder().decode(bytesFromBase64Url(value))
  );
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('apple token segment invalid');
  }
  return parsed as Record<string, unknown>;
}

export async function verifyAppleIdToken(args: {
  readonly http: HttpClient;
  readonly apple: AppleProviderConfig;
  readonly idToken: string;
  readonly nonce: string;
  readonly nowMs: number;
}): Promise<AppleUserInfo> {
  const parts = args.idToken.split('.');
  if (parts.length !== 3) throw new Error('apple token malformed');
  const header = jsonFromBase64Url(parts[0] ?? '');
  const payload = jsonFromBase64Url(parts[1] ?? '');
  const kid = header['kid'];
  const keysRes = await args.http.fetch(APPLE_OAUTH_KEYS_URL);
  if (!keysRes.ok) throw new Error('apple keys unavailable');
  const jwks: unknown = await keysRes.json();
  const keys =
    jwks !== null && typeof jwks === 'object'
      ? (jwks as { keys?: unknown }).keys
      : null;
  if (!Array.isArray(keys)) throw new Error('apple keys invalid');
  const jwk = keys.find(
    (key) =>
      key !== null &&
      typeof key === 'object' &&
      (key as { kid?: unknown }).kid === kid
  );
  if (jwk === undefined || typeof jwk !== 'object') {
    throw new Error('apple signing key missing');
  }
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk as JsonWebKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = bytesFromBase64Url(parts[2] ?? '');
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature,
    signed
  );
  if (!valid) throw new Error('apple token signature invalid');
  if (payload['iss'] !== APPLE_ISSUER) throw new Error('apple token issuer');
  if (payload['aud'] !== args.apple.clientId)
    throw new Error('apple token audience');
  const exp = payload['exp'];
  if (typeof exp !== 'number' || exp * 1000 <= args.nowMs) {
    throw new Error('apple token expired');
  }
  if (payload['nonce'] !== args.nonce) throw new Error('apple token nonce');
  const sub = payload['sub'];
  if (typeof sub !== 'string' || sub.length === 0) {
    throw new Error('apple token subject');
  }
  const email = payload['email'];
  return { sub, email: typeof email === 'string' ? email : null };
}
