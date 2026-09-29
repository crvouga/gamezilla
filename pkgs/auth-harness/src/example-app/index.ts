/**
 * The one example app of `@pkgs/auth-harness`: the relying party (the
 * in-house auth app under `/api`) and the Google and Apple providers it is
 * registered at, with who exists at each.
 */

export {
  APPLE_DIRECTORY,
  type AuthIdp,
  type AuthIdps,
  accountAt,
  accountIdOf,
  DIRECTORIES,
  type DirectoryEntry,
  emailOfEntry,
  GOOGLE_DIRECTORY,
  idpForUrl,
  NO_PROVIDER_FAULTS,
  type ProviderFaults,
  startIdpNodes,
} from './providers';
export {
  APPLE_CLIENT_ID,
  APPLE_KEY_ID,
  APPLE_ORIGIN,
  APPLE_TEAM_ID,
  AUTH_SYSTEM_BASE_URL,
  AUTH_SYSTEM_CALLBACK_URL,
  AUTH_SYSTEM_PATH_PREFIX,
  AUTH_SYSTEM_SECRET,
  AUTH_SYSTEM_TRUSTED_ORIGINS,
  appleRelyingPartyConfig,
  buildExampleApp,
  EXAMPLE_APP_API,
  EXAMPLE_APP_NAME,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_ORIGIN,
} from './relying-party';
