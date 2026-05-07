/**
 * Provider-agnostic auth facade. Hosted auth implementation lives under `./better-auth`.
 */
export type * from './ports';
export type { AuthContext } from './types';
export { ANON_ID_HEADER, createSessionAuth } from './session-middleware';
export type { SessionAuthDeps } from './session-middleware';
export { UnauthorizedError } from './unauthorized-error';
export {
  createBetterAuthHttpBearerAuthPorts as createHttpBearerAuthPorts,
  mountHostedAuthRoutes as mountHostedAuthHandler,
} from './better-auth/bootstrap';
