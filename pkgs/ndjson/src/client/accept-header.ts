import { EVENT_STREAM_CONTENT_TYPE } from '../shared/content-type';

/**
 * Returns true when the supplied `Accept` header (or any incoming string)
 * advertises indexed SSE streaming support. Use on the server to negotiate
 * streaming vs a flat JSON fallback.
 */
export function acceptsEventStream(
  acceptHeader: string | null | undefined
): boolean {
  if (acceptHeader === null || acceptHeader === undefined) return false;
  return acceptHeader.includes(EVENT_STREAM_CONTENT_TYPE);
}

/**
 * Build a client `Accept` header value that prefers SSE streaming but
 * still falls back to the supplied alternative. Defaults to allowing flat
 * `application/json` so a server that does not yet support streaming can
 * answer the same request.
 */
export function eventStreamAcceptHeader(
  fallback: string = 'application/json'
): string {
  return `${EVENT_STREAM_CONTENT_TYPE}, ${fallback}`;
}

/** @deprecated Use {@link acceptsEventStream}. */
export const acceptsNdjson = acceptsEventStream;

/** @deprecated Use {@link eventStreamAcceptHeader}. */
export const ndjsonAcceptHeader = eventStreamAcceptHeader;
