/**
 * Auth server facade.
 */
export type { AuthContext } from './types';
export { ANON_ID_HEADER, createSessionAuth } from './session-middleware';
export type { SessionAuth, SessionAuthDeps } from './session-middleware';
export { UnauthorizedError } from './unauthorized-error';
export { mountHostedAuthRoutes as mountHostedAuthHandler } from './better-auth-bootstrap';
export {
  resolveAccountIdFromBearer,
  buildAppAuthContextFromBearer,
} from './bearer-resolve';
export type { HostedBetterAuth } from './better-auth-create';
