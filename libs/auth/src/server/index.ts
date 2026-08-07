/**
 * Auth server facade.
 */

export type { AppRulesAuth } from '../shared/app-rules-auth';
export { mapAppAuthToRulesAuth } from '../shared/map-app-auth-to-rules-auth';
export {
  buildAppAuthContextFromBearer,
  resolveAccountIdFromBearer,
} from './bearer-resolve';
export type { SessionAuth, SessionAuthDeps } from './session-middleware';
export { ANON_ID_HEADER, createSessionAuth } from './session-middleware';
export type { AuthContext } from './types';
export { UnauthorizedError } from './unauthorized-error';
