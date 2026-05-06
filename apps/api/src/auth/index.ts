/**
 * Provider-agnostic auth facade. Clerk lives only under `./clerk`.
 */
export type * from './ports';
export type { AuthContext } from './types';
export { ANON_ID_HEADER, createSessionAuth } from './session-middleware';
export type { SessionAuthDeps } from './session-middleware';
export { UnauthorizedError } from './unauthorized-error';
export { createClerkHttpBearerAuthPorts } from './clerk';
