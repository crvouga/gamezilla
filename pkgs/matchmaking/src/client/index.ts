/**
 * HTTP client for the matchmaking app.
 *
 * Import via `@pkgs/matchmaking/client`. Backend-agnostic — talks only
 * to the shared HTTP routes.
 */

export {
  MatchmakingClient,
  type MatchmakingClientOptions,
} from './client';
export { MatchmakingHttpError } from './client-error';
export { type DevicePorts, MatchmakingDevice } from './device';
