/**
 * Re-exports of `@gamezilla/api-types/api-hono-types`. Definitions live in
 * the api-types leaf so feature packages don't need to depend on the api
 * package. Local consumers (the api package itself) keep importing through
 * this path.
 */
export type {
  ApiHonoEnv,
  HostedBetterAuth,
} from '@gamezilla/api-types/api-hono-types';
