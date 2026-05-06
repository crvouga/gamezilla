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

export const DeviceAttr = {
  id: 'device/id',
  createdAt: 'device/createdAt',
  /** 'ios' | 'android' | 'web' — from React Native Platform.OS */
  platform: 'device/platform',
  osName: 'device/osName',
  osVersion: 'device/osVersion',
  deviceModelName: 'device/deviceModelName',
  deviceBrand: 'device/deviceBrand',
  deviceName: 'device/deviceName',
  appVersion: 'device/appVersion',
  appBuildNumber: 'device/appBuildNumber',
  /** Web only — from navigator.userAgent */
  userAgent: 'device/userAgent',
  firstSeenAt: 'device/firstSeenAt',
  lastSeenAt: 'device/lastSeenAt',
} as const;

export const AccountAttr = {
  id: 'account/id',
  createdAt: 'account/createdAt',
  /** Stripe customer id (`cus_…`) for this account — set by checkout in the API. */
  stripeCustomerId: 'account/stripeCustomerId',
} as const;

export const AccountProviderAttr = {
  accountId: 'accountProvider/accountId',
  provider: 'accountProvider/provider',
  providerUserId: 'accountProvider/providerUserId',
  email: 'accountProvider/email',
  linkedAt: 'accountProvider/linkedAt',
} as const;

export const AccountSessionAttr = {
  deviceId: 'accountSession/deviceId',
  accountId: 'accountSession/accountId',
  token: 'accountSession/token',
  expiresAt: 'accountSession/expiresAt',
  createdAt: 'accountSession/createdAt',
} as const;

export const GOOGLE_PROVIDER = 'google' as const;

/** Clerk user id is stored in {@link AccountProviderAttr.providerUserId}. */
export const CLERK_PROVIDER = 'clerk' as const;
