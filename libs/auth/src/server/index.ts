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
