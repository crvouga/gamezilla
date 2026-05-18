/**
 * Thrown by {@link MatchmakingClient} for any non-2xx HTTP response (or for a
 * 404 from `/status/:playerId` reached during `waitForMatch`). Exposes the raw
 * status code so callers can switch on it without parsing message strings.
 */

export class MatchmakingHttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}
