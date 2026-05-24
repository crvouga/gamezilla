/**
 * NDJSON frame types for the indexed streaming protocol.
 *
 * One SSE `data:` event per indexed frame:
 *
 * ```
 * data: {"frame":"result","index":0,"result":{...}}
 *
 * data: {"frame":"result","index":2,"result":{...}}
 *
 * data: {"frame":"error","index":1,"status":500,"message":"..."}
 *
 * data: {"frame":"end"}
 *
 * ```
 *
 * `result` and `error` frames carry an `index` so the consumer can place
 * each slice back in its original request position regardless of the order
 * in which the server emits them. The stream MUST always finish with a
 * single `end` frame so the consumer can differentiate a graceful close
 * from a truncated transport.
 *
 * Per-item errors are emitted inline as `error` frames so one slow /
 * failing item does not poison faster siblings sharing the same request.
 */

export type NdjsonResultFrame<T = unknown> = {
  readonly frame: 'result';
  readonly index: number;
  readonly result: T;
};

export type NdjsonErrorFrame = {
  readonly frame: 'error';
  readonly index: number;
  readonly status: number;
  readonly message: string;
  /**
   * Optional discriminator the producer can attach to an error frame so
   * the consumer can branch on a specific failure shape (e.g. promote
   * certain server crashes to a different client-side flow).
   */
  readonly kind?: string;
  /** Optional structured context attached to the error. */
  readonly context?: Record<string, unknown>;
};

export type NdjsonEndFrame = {
  readonly frame: 'end';
};

export type NdjsonFrame<T = unknown> =
  | NdjsonResultFrame<T>
  | NdjsonErrorFrame
  | NdjsonEndFrame;
