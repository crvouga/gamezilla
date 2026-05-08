import { createAttrNamespace } from '@gamezilla/lib/attribute';

/**
 * PatchDB entity type for the replication device: a stable identifier for this
 * app install, generated and owned by the client.
 */
export const DEVICE_ENTITY_TYPE = 'device';

/**
 * PatchDB entity type for a registered account: established when a person signs
 * up and authenticates. Absence indicates an anonymous (unregistered) actor at
 * the identity layer (the client may still have a device + client cookie).
 */
export const ACCOUNT_ENTITY_TYPE = 'account';

/** PatchDB entity type linking an OAuth provider to an account. */
export const ACCOUNT_PROVIDER_ENTITY_TYPE = 'accountProvider';

/**
 * PatchDB entity type for an authenticated session belonging to an account,
 * established at login (opaque token in PatchDB).
 */
export const ACCOUNT_SESSION_ENTITY_TYPE = 'accountSession';

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

/** Device entity attributes (`device/…`). */
export const DeviceAttr = {
  id: deviceNs('id', readString),
  createdAt: deviceNs('createdAt', readTrimmedNullableString),
  /** 'ios' | 'android' | 'web' — from React Native Platform.OS */
  platform: deviceNs('platform', readTrimmedNullableString),
  osName: deviceNs('osName', readTrimmedNullableString),
  osVersion: deviceNs('osVersion', readTrimmedNullableString),
  deviceModelName: deviceNs('deviceModelName', readTrimmedNullableString),
  deviceBrand: deviceNs('deviceBrand', readTrimmedNullableString),
  deviceName: deviceNs('deviceName', readTrimmedNullableString),
  appVersion: deviceNs('appVersion', readTrimmedNullableString),
  appBuildNumber: deviceNs('appBuildNumber', readTrimmedNullableString),
  /** Web only — from navigator.userAgent */
  userAgent: deviceNs('userAgent', readTrimmedNullableString),
  firstSeenAt: deviceNs('firstSeenAt', readTrimmedNullableString),
  lastSeenAt: deviceNs('lastSeenAt', readTrimmedNullableString),
} as const;

const accountNs = createAttrNamespace('account');

export const AccountAttr = {
  id: accountNs('id', readString),
  createdAt: accountNs('createdAt', readString),
  /** Stripe customer id (`cus_…`) for this account — set by checkout in the API. */
  stripeCustomerId: accountNs('stripeCustomerId', readOptionalString),
} as const;

const accountProviderNs = createAttrNamespace('accountProvider');

export const AccountProviderAttr = {
  accountId: accountProviderNs('accountId', readString),
  provider: accountProviderNs('provider', readTrimmedNullableString),
  providerUserId: accountProviderNs('providerUserId', readTrimmedNullableString),
  email: accountProviderNs('email', readTrimmedNullableString),
  linkedAt: accountProviderNs('linkedAt', readTrimmedNullableString),
} as const;

const accountSessionNs = createAttrNamespace('accountSession');

export const AccountSessionAttr = {
  deviceId: accountSessionNs('deviceId', readString),
  accountId: accountSessionNs('accountId', readString),
  token: accountSessionNs('token', readString),
  expiresAt: accountSessionNs('expiresAt', readTrimmedNullableString),
  createdAt: accountSessionNs('createdAt', readTrimmedNullableString),
} as const;

export const GOOGLE_PROVIDER = 'google' as const;
