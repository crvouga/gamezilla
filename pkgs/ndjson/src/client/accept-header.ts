import { NDJSON_CONTENT_TYPE } from '../shared/content-type';

/**
 * Returns true when the supplied `Accept` header (or any incoming string)
 * advertises NDJSON support. Use on the server to negotiate streaming vs
 * a flat JSON fallback.
 */
export function acceptsNdjson(
  acceptHeader: string | null | undefined
): boolean {
  if (acceptHeader === null || acceptHeader === undefined) return false;
  return acceptHeader.includes(NDJSON_CONTENT_TYPE);
}

/**
 * Build a client `Accept` header value that prefers NDJSON streaming but
 * still falls back to the supplied alternative. Defaults to allowing flat
 * `application/json` so a server that does not yet support streaming can
 * answer the same request.
 */
export function ndjsonAcceptHeader(
  fallback: string = 'application/json'
): string {
  return `${NDJSON_CONTENT_TYPE}, ${fallback}`;
}
