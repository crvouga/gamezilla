import { Assert } from '@gamezilla/lib/assert'

const validation: Assert = Assert.validation()

/**
 * Serializable message envelope: a type tag plus an extensible payload.
 */
export type Message<P = unknown> = { type: string; payload: P }

/**
 * Runtime check for `payload` before a message is constructed or after `type` matches.
 * Must return `true` only when `payload` satisfies the invariants of `P`.
 */
export type MessagePayloadValidator<P> = (payload: unknown) => payload is P

export interface MessageTag<P = unknown> {
  readonly type: string
  readonly validatePayload: MessagePayloadValidator<P>
  /** Validates `payload` then returns `{ type, payload }`; throws `ValidationError` on failure. */
  (payload: unknown): Message<P>
  /** True when `msg.type` matches this tag and `validatePayload(msg.payload)` passes. */
  is(msg: Message): msg is Message<P>
}

export interface MessageNamespace {
  readonly prefix: string
  /**
   * @param name - Short message name (becomes `{prefix}/{name}` on the wire).
   * @param validatePayload - Required runtime guard; unsafe to omit when `P` carries invariants.
   */
  <P>(name: string, validatePayload: MessagePayloadValidator<P>): MessageTag<P>
  /** True when `msg.type` starts with `${prefix}/`. */
  owns(msg: Message): boolean
}

/** Plain non-null object (not array). Useful inside {@link MessagePayloadValidator}s. */
export function isPlainRecord(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Validator that accepts any payload. Use only when the wire format truly carries no
 * structured invariants (e.g. tests or opaque blobs).
 */
export function acceptUnknownPayload(_payload: unknown): _payload is unknown {
  return true
}

function assertValidPrefixOrName(label: string, value: string): void {
  validation.nonEmptyString(value, `${label} must be non-empty`)
  validation.ok(!value.includes('/'), `${label} must not contain '/'`)
}

function createMessageTag<P>(
  fullType: string,
  validatePayload: MessagePayloadValidator<P>,
): MessageTag<P> {
  function tag(payload: unknown): Message<P> {
    if (!validatePayload(payload)) {
      validation.fail(`invalid payload for message type ${fullType}`, {
        type: fullType,
        payload,
      })
    }
    return { type: fullType, payload }
  }
  Object.defineProperty(tag, 'type', {
    value: fullType,
    enumerable: false,
    configurable: false,
    writable: false,
  })
  Object.defineProperty(tag, 'validatePayload', {
    value: validatePayload,
    enumerable: false,
    configurable: false,
    writable: false,
  })
  tag.is = (msg: Message): msg is Message<P> =>
    msg.type === fullType && validatePayload(msg.payload)
  return tag as MessageTag<P>
}

/**
 * Creates a namespace for message type strings: `{prefix}/{name}`.
 *
 * Every tag **must** supply {@link MessagePayloadValidator} so constructors and `.is()`
 * cannot trust TypeScript types alone at the wire boundary.
 *
 * @example
 * ```ts
 * const cmd = createNamespace('ticTacToe')
 * const PlaceMark = cmd('PLACE_MARK', (p): p is { cell: number } =>
 *   isPlainRecord(p) &&
 *   typeof p['cell'] === 'number' &&
 *   Number.isInteger(p['cell'])
 * )
 * const m = PlaceMark({ cell: 0 })
 * if (PlaceMark.is(m)) { m.payload.cell }
 * ```
 */
export function createNamespace(prefix: string): MessageNamespace {
  assertValidPrefixOrName('namespace prefix', prefix)

  function bind<P>(
    name: string,
    validatePayload: MessagePayloadValidator<P>,
  ): MessageTag<P> {
    assertValidPrefixOrName('message name', name)
    const fullType = `${prefix}/${name}`
    return createMessageTag(fullType, validatePayload)
  }

  Object.defineProperty(bind, 'prefix', {
    value: prefix,
    enumerable: false,
    configurable: false,
    writable: false,
  })
  bind.owns = (msg: Message): boolean => msg.type.startsWith(`${prefix}/`)

  return bind as MessageNamespace
}
