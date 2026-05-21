import { createAttrNamespace } from '@pkgs/attribute';

function readString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readOptionalString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
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
  id: deviceNs('id', readString),
  createdAt: deviceNs('created-at', readTrimmedNullableString),
  /** 'ios' | 'android' | 'web' — from React Native Platform.OS */
  platform: deviceNs('platform', readTrimmedNullableString),
  osName: deviceNs('os-name', readTrimmedNullableString),
  osVersion: deviceNs('os-version', readTrimmedNullableString),
  deviceModelName: deviceNs('device-model-name', readTrimmedNullableString),
  deviceBrand: deviceNs('device-brand', readTrimmedNullableString),
  deviceName: deviceNs('device-name', readTrimmedNullableString),
  appVersion: deviceNs('app-version', readTrimmedNullableString),
  appBuildNumber: deviceNs('app-build-number', readTrimmedNullableString),
  /** Web only — from navigator.userAgent */
  userAgent: deviceNs('user-agent', readTrimmedNullableString),
  firstSeenAt: deviceNs('first-seen-at', readTrimmedNullableString),
  lastSeenAt: deviceNs('last-seen-at', readTrimmedNullableString),
} as const;

const accountNs = createAttrNamespace('account');

export const ACCOUNT_ENTITY_TYPE = accountNs.prefix;

export const AccountAttr = {
  id: accountNs('id', readString),
  createdAt: accountNs('created-at', readString),
  /** Stripe customer id (`cus_…`) for this account — set by checkout in the API. */
  stripeCustomerId: accountNs('stripe-customer-id', readOptionalString),
} as const;

const accountProviderNs = createAttrNamespace('account', 'provider');

export const ACCOUNT_PROVIDER_ENTITY_TYPE = accountProviderNs.prefix;

export const AccountProviderAttr = {
  accountId: accountProviderNs('account-id', readString),
  provider: accountProviderNs('provider', readTrimmedNullableString),
  providerUserId: accountProviderNs(
    'provider-user-id',
    readTrimmedNullableString
  ),
  email: accountProviderNs('email', readTrimmedNullableString),
  linkedAt: accountProviderNs('linked-at', readTrimmedNullableString),
} as const;

const accountSessionNs = createAttrNamespace('account', 'session');

export const ACCOUNT_SESSION_ENTITY_TYPE = accountSessionNs.prefix;
export const AccountSessionAttr = {
  deviceId: accountSessionNs('device-id', readString),
  accountId: accountSessionNs('account-id', readString),
  token: accountSessionNs('token', readString),
  expiresAt: accountSessionNs('expires-at', readTrimmedNullableString),
  createdAt: accountSessionNs('created-at', readTrimmedNullableString),
} as const;

export const GOOGLE_PROVIDER = 'google' as const;
