/** PatchDB entity type for the device principal. */
export const PRINCIPAL_ENTITY_TYPE = 'principal';

/** PatchDB entity type for a server account. */
export const ACCOUNT_ENTITY_TYPE = 'account';

/** PatchDB entity type linking an OAuth provider to an account. */
export const ACCOUNT_PROVIDER_ENTITY_TYPE = 'accountProvider';

/** PatchDB entity type for an authenticated session (opaque token in PatchDB). */
export const PRINCIPAL_SESSION_ENTITY_TYPE = 'principalSession';

export const PrincipalAttr = {
  id: 'principal/id',
  createdAt: 'principal/createdAt',
  accountId: 'principal/accountId',
  /** 'ios' | 'android' | 'web' — from React Native Platform.OS */
  platform: 'principal/platform',
  osName: 'principal/osName',
  osVersion: 'principal/osVersion',
  deviceModelName: 'principal/deviceModelName',
  deviceBrand: 'principal/deviceBrand',
  deviceName: 'principal/deviceName',
  appVersion: 'principal/appVersion',
  appBuildNumber: 'principal/appBuildNumber',
  /** Web only — from navigator.userAgent */
  userAgent: 'principal/userAgent',
  firstSeenAt: 'principal/firstSeenAt',
  lastSeenAt: 'principal/lastSeenAt',
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
  providerAccountId: 'accountProvider/providerAccountId',
  email: 'accountProvider/email',
  linkedAt: 'accountProvider/linkedAt',
} as const;

export const PrincipalSessionAttr = {
  principalId: 'principalSession/principalId',
  accountId: 'principalSession/accountId',
  token: 'principalSession/token',
  expiresAt: 'principalSession/expiresAt',
  createdAt: 'principalSession/createdAt',
} as const;

export const GOOGLE_PROVIDER = 'google' as const;
