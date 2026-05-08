import { Assert } from '@gamezilla/lib/assert';
import type { JoinDot } from '../attribute/attribute';
import {
  CLOJURE_KEBAB_SEGMENT,
  isClojureNamespacePrefix,
} from '../attribute/attribute';

const crash: Assert = Assert.crash();

/**
 * Serializable message envelope: a type tag plus an extensible payload.
 */
export type Message<P = unknown> = { type: string; payload: P };

/**
 * Runtime check for `payload` before a message is constructed or after `type` matches.
 * Must return `true` only when `payload` satisfies the invariants of `P`.
 */
export type MessagePayloadValidator<P> = (payload: unknown) => payload is P;

export interface MessageTag<P = unknown> {
  readonly type: string;
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
 * Validator that accepts any payload. Use only when the wire format truly carries no
 * structured invariants (e.g. tests or opaque blobs).
 */
export function acceptUnknownPayload(_payload: unknown): _payload is unknown {
  return true;
}

function assertValidMessageSegment(label: string, value: string): void {
  crash.nonEmptyString(value, `${label} must be non-empty`);
  crash.ok(!value.includes('/'), `${label} must not contain '/'`);
  crash.ok(!value.includes('.'), `${label} must not contain '.'`);
  crash.ok(
    CLOJURE_KEBAB_SEGMENT.test(value),
    `${label} must be kebab-case (lowercase letter, then alnum/hyphens; no uppercase, underscores, or spaces)`
  );
}

function createMessageTag<P>(
  fullType: string,
  validatePayload: MessagePayloadValidator<P>
): MessageTag<P> {
  function tag(payload: unknown): Message<P> {
    if (!validatePayload(payload)) {
      crash.fail(`invalid payload for message type ${fullType}`, {
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
  crash.ok(
    segments.length > 0,
    'createMessageNamespace requires at least one namespace segment'
  );
  for (const seg of segments) {
    assertValidMessageSegment('namespace segment', seg);
  }
  const prefix = segments.join('.') as JoinDot<Segments>;
  crash.ok(
    isClojureNamespacePrefix(prefix),
    'message namespace prefix must be valid dot-separated kebab segments'
  );

  function bind<P>(
    name: string,
    validatePayload: MessagePayloadValidator<P>
  ): MessageTag<P> {
    assertValidMessageSegment('message name', name);
    const fullType = `${prefix as string}/${name}`;
    crash.ok(
      fullType.indexOf('/') === fullType.lastIndexOf('/'),
      'message type must contain exactly one slash between namespace and name'
    );
    return createMessageTag(fullType, validatePayload);
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
