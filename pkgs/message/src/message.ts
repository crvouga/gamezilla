import { assert, type Assert } from '@gamezilla/assert';
import type { JoinDot, Keyword } from '@gamezilla/keyword/keyword';
import {
  assertLocalName,
  assertNamespacedKeyword,
  isNamespacedKeyword,
  joinKeywordSegments,
} from '@gamezilla/keyword/keyword';

/**
 * Serializable message envelope: a {@link Keyword} type tag plus an extensible payload.
 * `type` is branded so raw strings cannot be assigned; produce envelopes via a
 * {@link MessageTag} from {@link createMessageNamespace}.
 */
export type Message<P = unknown> = { type: Keyword; payload: P };

/**
 * Runtime check for `payload` before a message is constructed or after `type` matches.
 * Must return `true` only when `payload` satisfies the invariants of `P`.
 */
export type MessagePayloadValidator<P> = (payload: unknown) => payload is P;

export interface MessageTag<P = unknown> {
  readonly type: Keyword;
  readonly validatePayload: MessagePayloadValidator<P>;
  /** Validates `payload` then returns `{ type, payload }`; crashes on failure. */
  (payload: unknown): Message<P>;
  /** True when `msg.type` matches this tag and `validatePayload(msg.payload)` passes. */
  is(msg: Message): msg is Message<P>;
}

export interface MessageNamespace<Prefix extends string = string> {
  readonly prefix: Prefix;
  /**
   * @param name - Short message name (becomes `{prefix}/{name}` on the wire).
   * @param validatePayload - Required runtime guard; unsafe to omit when `P` carries invariants.
   */
  <P>(name: string, validatePayload: MessagePayloadValidator<P>): MessageTag<P>;
  /** True when `msg.type` starts with `${prefix}/`. */
  owns(msg: Message): boolean;
}

/** Plain non-null object (not array). Useful inside {@link MessagePayloadValidator}s. */
export function isPlainRecord(
  value: unknown
): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * True when `value` is a plain object with a wire-valid {@link Message.type}
 * (`prefix/local` namespaced keyword) and a `payload` property (any value).
 */
export function isMessageEnvelope(value: unknown): value is Message {
  if (!isPlainRecord(value)) return false;
  if (!('type' in value) || typeof value['type'] !== 'string') return false;
  if (!isNamespacedKeyword(value['type'])) return false;
  if (!('payload' in value)) return false;
  return true;
}

/**
 * Tiger-style hard assert: crashes when `value` is not a wire-valid message
 * envelope. Use at trust boundaries (router dispatch, wire ingress, persistent
 * log replay) so corrupted data fails fast instead of silently dispatching.
 *
 * `a` controls cost: pass `assert` (always-on) at trust boundaries; pass
 * `hotAssert()` from `@gamezilla/assert` on per-routed-message hot paths.
 */
export function assertMessageEnvelope(
  a: Assert,
  value: unknown
): asserts value is Message {
  a.ok(
    isMessageEnvelope(value),
    'value is not a valid Message envelope ({ type: Keyword, payload })',
    { value }
  );
}

/**
 * Validator that accepts any payload. Use only when the wire format truly carries no
 * structured invariants (e.g. tests or opaque blobs).
 */
export function acceptUnknownPayload(_payload: unknown): _payload is unknown {
  return true;
}

function assertValidMessageSegment(
  a: Assert,
  _label: string,
  value: string
): void {
  assertLocalName(a, value);
}

function createMessageTag<P>(
  fullType: Keyword,
  validatePayload: MessagePayloadValidator<P>
): MessageTag<P> {
  function tag(payload: unknown): Message<P> {
    if (!validatePayload(payload)) {
      assert.fail(`invalid payload for message type ${fullType}`, {
        type: fullType,
        payload,
      });
    }
    return { type: fullType, payload };
  }
  Object.defineProperty(tag, 'type', {
    value: fullType,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  Object.defineProperty(tag, 'validatePayload', {
    value: validatePayload,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  tag.is = (msg: Message): msg is Message<P> =>
    msg.type === fullType && validatePayload(msg.payload);
  return tag as MessageTag<P>;
}

/**
 * Creates a namespace for message type strings: `{prefix}/{name}` where `prefix` is
 * `segment0.segment1...` from the given kebab-case segments.
 *
 * Every tag **must** supply {@link MessagePayloadValidator} so constructors and `.is()`
 * cannot trust TypeScript types alone at the wire boundary.
 */
export function createMessageNamespace<
  const Segments extends readonly string[],
>(...segments: Segments): MessageNamespace<JoinDot<Segments>> {
  assert.ok(
    segments.length > 0,
    'createMessageNamespace requires at least one namespace segment'
  );
  for (const seg of segments) {
    assertValidMessageSegment(assert, 'namespace segment', seg);
  }
  const prefix = joinKeywordSegments(...segments) as JoinDot<Segments>;

  function bind<P>(
    name: string,
    validatePayload: MessagePayloadValidator<P>
  ): MessageTag<P> {
    assertValidMessageSegment(assert, 'message name', name);
    const fullTypeStr = `${prefix as string}/${name}`;
    assertNamespacedKeyword(assert, fullTypeStr);
    return createMessageTag(fullTypeStr, validatePayload);
  }

  Object.defineProperty(bind, 'prefix', {
    value: prefix,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  bind.owns = (msg: Message): boolean => msg.type.startsWith(`${prefix}/`);

  return bind as MessageNamespace<JoinDot<Segments>>;
}
