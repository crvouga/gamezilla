/**
 * Re-export of `@gamezilla/api-types/secret-names`. Lives in api-types so
 * feature packages (e.g. `client-config`, `auth`) can read Doppler keys
 * without depending on the api package itself.
 */
export { ApiSecretName } from '@gamezilla/api-types/secret-names';
