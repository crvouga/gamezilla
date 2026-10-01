export { IDP_PROVIDER_LABEL } from '../shared/provider-label';
export { IDP_TABLES, idpSchema } from '../shared/schema/tables';
export {
  buildAuthTrustedOrigins,
  isTrustedCallbackUrl,
} from '../shared/trusted-origins';
export {
  type CreateAuthAppDeps,
  type CreateAuthAppProviders,
  createAuthApp,
} from './create-auth-app';
export {
  type CreateAuthServerAdapterDeps,
  createAuthServerAdapter,
} from './create-auth-server-adapter';
export { identityJson } from './identity-handlers';
export { IdentityLinker, type LinkOutcome, maskEmail } from './identity-linker';
export { IdentityRepository, type IdentityRow } from './identity-repository';
export { IdpRepository } from './idp-repository';
export {
  appleEndpointsFor,
  googleEndpointsFor,
  INHOUSE_AUTH_SECRET,
} from './inhouse-auth-config';
export { INHOUSE_AUTH_PROVIDER } from './inhouse-auth-provider';
export {
  createOauthCallbackRelayApp,
  type OauthCallbackRelay,
  parseRelayTargets,
} from './oauth-callback-relay';
export {
  type AppleProviderConfig,
  appleClientSecret,
  buildAppleAuthorizationUrl,
} from './providers/apple-oauth';
export {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  type GoogleProviderConfig,
} from './providers/google-oauth';
export type { ProviderIdentity } from './providers/provider-identity';
export type { OauthProvidersConfig } from './providers/registry';
export { reconcileIdpPostgres } from './reconcile-idp-postgres';
export { reconcileIdpSqlite } from './reconcile-idp-sqlite';
export {
  SYNTHETIC_MONITOR_PROVIDER,
  SYNTHETIC_MONITOR_USER,
  type SyntheticMonitorConfig,
} from './synthetic-monitor';
