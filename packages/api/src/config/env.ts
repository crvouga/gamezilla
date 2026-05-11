/**
 * Re-exports of `@gamezilla/api-types/env` so existing `@gamezilla/api/config/env`
 * imports keep working. The actual definitions live in the api-types leaf so
 * feature packages (`auth`, `spaces`, `client-config`) can depend on them
 * without pulling in the api package.
 */
export {
  ConfigurationError,
  assertDopplerTokenBinding,
  readDopplerScopeBindings,
  type ApiWorkerEnv,
  type HyperdriveBinding,
  type SpaceNamespace,
} from '@gamezilla/api-types/env';
