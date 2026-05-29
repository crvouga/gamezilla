/**
 * OAuth2 / OIDC core helpers used by the {@link createDevIdpRouter} router:
 * authorization-code issuance + consumption, PKCE S256 verification, access
 * token issuance + lookup, and the OIDC `/userinfo` claim shape.
 *
 * Both auth codes and access tokens persist in the injected {@link Kv} so
 * the flow survives worker reloads during local development. Each "table"
 * lives in a single {@link KvRecord} under its own {@link Keyword}; all
 * mutations go through `kv.tx(...)` for atomicity. Expired entries are
 * lazily evicted on read.
 */
import { assert } from '@pkgs/assert';
import { createAttrNamespace } from '@pkgs/attribute';
import { asKeyword, type Keyword } from '@pkgs/keyword/keyword';
import type { Kv, KvRecord } from '@pkgs/kv/interface';

import { DEV_IDP_ACCESS_TOKEN_TTL_SEC, DEV_IDP_CODE_TTL_MS } from './config';
import type { DevIdpUserProfile } from './dev-idp-user-store';

export const DEV_IDP_CODES_KEY: Keyword = asKeyword('dev-idp.kv/codes');
export const DEV_IDP_TOKENS_KEY: Keyword = asKeyword(
  'dev-idp.kv/access-tokens'
);

export type DevIdpAuthCode = {
  readonly code: string;
  readonly userSub: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scope: string;
  readonly state: string | null;
  readonly nonce: string | null;
  readonly codeChallenge: string | null;
  readonly codeChallengeMethod: string | null;
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
};

export type DevIdpAccessToken = {
  readonly token: string;
  readonly userSub: string;
  readonly scope: string;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
};

const CodesNs = createAttrNamespace('dev-idp', 'codes-record');
const TokensNs = createAttrNamespace('dev-idp', 'tokens-record');

type CodesTable = Record<string, DevIdpAuthCode>;
type TokensTable = Record<string, DevIdpAccessToken>;

function parsePlainObject(v: unknown, label: string): Record<string, unknown> {
  if (v === null || v === undefined) return {};
  assert.ok(
    typeof v === 'object' && !Array.isArray(v),
    `${label}: data must be a plain object`
  );
  return v as Record<string, unknown>;
}

function parseCodesTable(v: unknown): CodesTable {
  const obj = parsePlainObject(v, 'dev-idp codes record');
  const out: CodesTable = {};
  for (const [code, raw] of Object.entries(obj)) {
    const parsed = readCode(raw);
    if (parsed !== null) out[code] = parsed;
  }
  return out;
}

function parseTokensTable(v: unknown): TokensTable {
  const obj = parsePlainObject(v, 'dev-idp tokens record');
  const out: TokensTable = {};
  for (const [token, raw] of Object.entries(obj)) {
    const parsed = readToken(raw);
    if (parsed !== null) out[token] = parsed;
  }
  return out;
}

function readCode(raw: unknown): DevIdpAuthCode | null {
  if (raw === null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const code = readNonEmpty(r['code']);
  const userSub = readNonEmpty(r['userSub']);
  const clientId = readNonEmpty(r['clientId']);
  const redirectUri = readNonEmpty(r['redirectUri']);
  const scope = readString(r['scope']) ?? '';
  if (
    code === null ||
    userSub === null ||
    clientId === null ||
    redirectUri === null
  ) {
    return null;
  }
  const createdAtMs = readNumber(r['createdAtMs']) ?? Date.now();
  const expiresAtMs =
    readNumber(r['expiresAtMs']) ?? createdAtMs + DEV_IDP_CODE_TTL_MS;
  return {
    code,
    userSub,
    clientId,
    redirectUri,
    scope,
    state: readNullableString(r['state']),
    nonce: readNullableString(r['nonce']),
    codeChallenge: readNullableString(r['codeChallenge']),
    codeChallengeMethod: readNullableString(r['codeChallengeMethod']),
    createdAtMs,
    expiresAtMs,
  };
}

function readToken(raw: unknown): DevIdpAccessToken | null {
  if (raw === null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const token = readNonEmpty(r['token']);
  const userSub = readNonEmpty(r['userSub']);
  if (token === null || userSub === null) return null;
  const issuedAtMs = readNumber(r['issuedAtMs']) ?? Date.now();
  const expiresAtMs =
    readNumber(r['expiresAtMs']) ??
    issuedAtMs + DEV_IDP_ACCESS_TOKEN_TTL_SEC * 1000;
  return {
    token,
    userSub,
    scope: readString(r['scope']) ?? '',
    issuedAtMs,
    expiresAtMs,
  };
}

function readNonEmpty(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function readString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function readNullableString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  return v.length > 0 ? v : null;
}

function readNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

const CodesAttr = {
  data: CodesNs.json('data', (v) => parseCodesTable(v)),
} as const;
const TokensAttr = {
  data: TokensNs.json('data', (v) => parseTokensTable(v)),
} as const;

function encodeCodesTable(table: CodesTable): KvRecord {
  return CodesAttr.data(table as unknown as Record<string, unknown>);
}

function encodeTokensTable(table: TokensTable): KvRecord {
  return TokensAttr.data(table as unknown as Record<string, unknown>);
}

function pruneExpired<T extends { readonly expiresAtMs: number }>(
  table: Record<string, T>,
  nowMs: number
): { changed: boolean; live: Record<string, T> } {
  const live: Record<string, T> = {};
  let changed = false;
  for (const [key, entry] of Object.entries(table)) {
    if (entry.expiresAtMs > nowMs) {
      live[key] = entry;
    } else {
      changed = true;
    }
  }
  return { changed, live };
}

function randomToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const b64 =
    typeof globalThis.btoa === 'function'
      ? globalThis.btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Returns base64url-encoded SHA-256 of `verifier` (RFC 7636 §4.6). */
export async function pkceChallengeFromVerifier(
  verifier: string
): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

/**
 * Verifies a PKCE proof. `method` may be `'S256'` (preferred) or `'plain'`.
 * Returns `true` only when `method === 'S256'` and SHA256(verifier) ===
 * `challenge` (base64url), or when both are `'plain'`-equal.
 */
export async function verifyPkce(args: {
  verifier: string;
  challenge: string;
  method: string;
}): Promise<boolean> {
  if (args.method === 'S256') {
    const computed = await pkceChallengeFromVerifier(args.verifier);
    return constantTimeEquals(computed, args.challenge);
  }
  if (args.method === 'plain') {
    return constantTimeEquals(args.verifier, args.challenge);
  }
  return false;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export type IssueAuthCodeInput = {
  readonly userSub: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scope: string;
  readonly state: string | null;
  readonly nonce: string | null;
  readonly codeChallenge: string | null;
  readonly codeChallengeMethod: string | null;
};

/** Persists a fresh auth code (32-byte random) and returns it. */
export async function issueAuthCode(
  kv: Kv,
  input: IssueAuthCodeInput
): Promise<DevIdpAuthCode> {
  const now = Date.now();
  const entry: DevIdpAuthCode = {
    code: randomToken(32),
    userSub: input.userSub,
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    scope: input.scope,
    state: input.state,
    nonce: input.nonce,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: input.codeChallengeMethod,
    createdAtMs: now,
    expiresAtMs: now + DEV_IDP_CODE_TTL_MS,
  };
  await kv.tx(async (tx) => {
    const record = await tx.get(DEV_IDP_CODES_KEY);
    const current = record === null ? {} : CodesAttr.data.from(record);
    const { live } = pruneExpired(current, now);
    live[entry.code] = entry;
    await tx.put(DEV_IDP_CODES_KEY, encodeCodesTable(live));
  });
  return entry;
}

/**
 * Reads + atomically deletes an auth code. Returns `null` when missing or
 * expired. Always single-use, even when called concurrently.
 */
export async function consumeAuthCode(
  kv: Kv,
  code: string
): Promise<DevIdpAuthCode | null> {
  const now = Date.now();
  let consumed: DevIdpAuthCode | null = null;
  await kv.tx(async (tx) => {
    const record = await tx.get(DEV_IDP_CODES_KEY);
    if (record === null) return;
    const current = CodesAttr.data.from(record);
    const { live } = pruneExpired(current, now);
    const entry = live[code];
    if (entry === undefined) {
      await tx.put(DEV_IDP_CODES_KEY, encodeCodesTable(live));
      return;
    }
    consumed = entry;
    delete live[code];
    await tx.put(DEV_IDP_CODES_KEY, encodeCodesTable(live));
  });
  return consumed;
}

/** Persists a fresh access token (32-byte random) and returns it. */
export async function issueAccessToken(
  kv: Kv,
  args: { userSub: string; scope: string }
): Promise<DevIdpAccessToken> {
  const now = Date.now();
  const entry: DevIdpAccessToken = {
    token: randomToken(32),
    userSub: args.userSub,
    scope: args.scope,
    issuedAtMs: now,
    expiresAtMs: now + DEV_IDP_ACCESS_TOKEN_TTL_SEC * 1000,
  };
  await kv.tx(async (tx) => {
    const record = await tx.get(DEV_IDP_TOKENS_KEY);
    const current = record === null ? {} : TokensAttr.data.from(record);
    const { live } = pruneExpired(current, now);
    live[entry.token] = entry;
    await tx.put(DEV_IDP_TOKENS_KEY, encodeTokensTable(live));
  });
  return entry;
}

/** Looks up a non-expired access token. Returns `null` when missing/expired. */
export async function lookupAccessToken(
  kv: Kv,
  token: string
): Promise<DevIdpAccessToken | null> {
  const record = await kv.get(DEV_IDP_TOKENS_KEY);
  if (record === null) return null;
  const table = TokensAttr.data.from(record);
  const entry = table[token];
  if (entry === undefined) return null;
  if (entry.expiresAtMs <= Date.now()) return null;
  return entry;
}

/** OIDC `/userinfo` body shape (matches what Better Auth's generic-oauth reads). */
export type DevIdpUserInfo = {
  readonly sub: string;
  readonly email: string;
  readonly email_verified: boolean;
  readonly name: string;
  readonly picture?: string;
};

export function userInfoFromProfile(
  profile: DevIdpUserProfile
): DevIdpUserInfo {
  const base = {
    sub: profile.sub,
    email: profile.email,
    email_verified: true,
    name: profile.name,
  };
  if (profile.picture !== null) {
    return { ...base, picture: profile.picture };
  }
  return base;
}
