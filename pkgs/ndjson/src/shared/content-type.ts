/**
 * Canonical content-type for NDJSON streaming responses.
 *
 * Use as both the server's `Content-Type` header and a client `Accept`
 * header value when negotiating an NDJSON-capable response.
 */
export const NDJSON_CONTENT_TYPE = 'application/x-ndjson';
