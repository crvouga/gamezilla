/**
 * Canonical content-type for indexed batch streaming responses.
 *
 * Uses Server-Sent Events (`text/event-stream`) so browser DevTools can
 * parse and display the stream (EventStream tab). Each event carries one
 * JSON frame in a `data:` field.
 */
export const EVENT_STREAM_CONTENT_TYPE = 'text/event-stream';
