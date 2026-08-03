/**
 * Auth server facade.
 */
export type { AuthContext } from './types';
export { ANON_ID_HEADER, createSessionAuth } from './session-middleware';
export type { SessionAuth, SessionAuthDeps } from './session-middleware';
export { UnauthorizedError } from './unauthorized-error';
export {
  resolveAccountIdFromBearer,
  buildAppAuthContextFromBearer,
} from './bearer-resolve';
export type { AppRulesAuth } from '../shared/app-rules-auth';
export {
  mapAppAuthToRulesAuth,
  mapAppAuthToWriteContext,
} from '../shared/map-app-auth-to-rules-auth';
export { mapAppAuthToUploadAuth } from '../shared/map-app-auth-to-upload-auth';
