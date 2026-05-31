import { createAttrNamespace } from '@pkgs/attribute';

function readString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readOptionalString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

/** Trimmed non-empty string, else `null` (matches client `parseTrimmedStringAttr`). */
function readTrimmedNullableString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

const deviceNs = createAttrNamespace('device');

export const DEVICE_ENTITY_TYPE = deviceNs.prefix;

/** Device entity attributes (`device/…`). */
export const DeviceAttr = {
  /** Indexed: the device ABAC read policy scopes every query to `id = deviceId`. */
  id: deviceNs.text('id', readString).indexed(),
  createdAt: deviceNs.timestampOrNull('created-at', readTrimmedNullableString),
  /** 'ios' | 'android' | 'web' — from React Native Platform.OS */
  platform: deviceNs.textOrNull('platform', readTrimmedNullableString),
  osName: deviceNs.textOrNull('os-name', readTrimmedNullableString),
  osVersion: deviceNs.textOrNull('os-version', readTrimmedNullableString),
  deviceModelName: deviceNs.textOrNull(
    'device-model-name',
    readTrimmedNullableString
  ),
  deviceBrand: deviceNs.textOrNull('device-brand', readTrimmedNullableString),
  deviceName: deviceNs.textOrNull('device-name', readTrimmedNullableString),
  appVersion: deviceNs.textOrNull('app-version', readTrimmedNullableString),
  appBuildNumber: deviceNs.textOrNull(
    'app-build-number',
    readTrimmedNullableString
  ),
  /** Web only — from navigator.userAgent */
  userAgent: deviceNs.textOrNull('user-agent', readTrimmedNullableString),
  firstSeenAt: deviceNs.timestampOrNull(
    'first-seen-at',
    readTrimmedNullableString
  ),
  lastSeenAt: deviceNs.timestampOrNull(
    'last-seen-at',
    readTrimmedNullableString
  ),
} as const;

const accountNs = createAttrNamespace('account');

export const ACCOUNT_ENTITY_TYPE = accountNs.prefix;

export const AccountAttr = {
  /** Indexed: the account ABAC read policy scopes every query to `id = accountId`. */
  id: accountNs.text('id', readString).indexed(),
  createdAt: accountNs.timestamp('created-at', readString),
  /** Stripe customer id (`cus_…`) for this account — set by checkout in the API. */
  stripeCustomerId: accountNs.textOrNull(
    'stripe-customer-id',
    readOptionalString
  ),
} as const;

const accountProviderNs = createAttrNamespace('account', 'provider');

export const ACCOUNT_PROVIDER_ENTITY_TYPE = accountProviderNs.prefix;

export const AccountProviderAttr = {
  /** Indexed: provider rows are looked up by account during session validation. */
  accountId: accountProviderNs.text('account-id', readString).indexed(),
  /**
   * Indexed: account provisioning resolves an account by
   * (`provider`, `provider-user-id`) via a `where =` lookup, so both clauses
   * sit in an index-required position.
   */
  provider: accountProviderNs
    .textOrNull('provider', readTrimmedNullableString)
    .indexed(),
  providerUserId: accountProviderNs
    .textOrNull('provider-user-id', readTrimmedNullableString)
    .indexed(),
  email: accountProviderNs.emailOrNull('email', readTrimmedNullableString),
  linkedAt: accountProviderNs.timestampOrNull(
    'linked-at',
    readTrimmedNullableString
  ),
} as const;

const accountSessionNs = createAttrNamespace('account', 'session');

export const ACCOUNT_SESSION_ENTITY_TYPE = accountSessionNs.prefix;
export const AccountSessionAttr = {
  /** Indexed: sessions are revoked / listed by device. */
  deviceId: accountSessionNs.text('device-id', readString).indexed(),
  /** Indexed: sessions are listed by account on every authn check. */
  accountId: accountSessionNs.text('account-id', readString).indexed(),
  token: accountSessionNs.text('token', readString),
  expiresAt: accountSessionNs.timestampOrNull(
    'expires-at',
    readTrimmedNullableString
  ),
  createdAt: accountSessionNs.timestampOrNull(
    'created-at',
    readTrimmedNullableString
  ),
} as const;

export const GOOGLE_PROVIDER = 'google' as const;

/**
 * Provider id for the local fake OAuth2 / OIDC identity provider shipped by
 * `@pkgs/dev-idp`. Mirrors {@link GOOGLE_PROVIDER}: anywhere we branch on
 * `provider`, this constant is the single source of truth.
 */
export const DEV_PROVIDER = 'dev' as const;
