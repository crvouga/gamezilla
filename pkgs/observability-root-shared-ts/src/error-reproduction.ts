import { ATTR, type Attributes } from './attributes';
import { createAllowlistRedactor } from './redaction';

export type ErrorReproduction = {
  readonly format: string;
  /** An immutable JSON value, supplied explicitly by the failing operation. */
  readonly value: unknown;
};

const MAX_BYTES = 65_536;
type Budget = { remaining: number; nodes: number };
const CREDENTIAL_KEYS = new Set([
  'password',
  'secret',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'clientsecret',
  'authorization',
  'cookie',
  'setcookie',
  'email',
  'emailaddress',
  'privatekey',
]);

/** Never export a truncated, coerced or credential-redacted record as a replay. */
export function errorReproduction(reproduction: ErrorReproduction): Attributes {
  let encoded: string;
  try {
    if (!/^[a-z][a-z0-9.-]{0,63}$/.test(reproduction.format))
      throw new Error('unsupported');
    validate(
      reproduction.value,
      { remaining: MAX_BYTES, nodes: 4096 },
      new Set(),
      0
    );
    encoded = JSON.stringify(reproduction.value);
    if (new TextEncoder().encode(encoded).byteLength > MAX_BYTES)
      throw new Error('too_large');
  } catch (error) {
    return {
      [ATTR.APP_ERROR_REPRODUCTION_STATUS]: rejectionReason(error),
    };
  }
  if (
    createAllowlistRedactor()(ATTR.APP_ERROR_REPRODUCTION, encoded) !== encoded
  )
    return { [ATTR.APP_ERROR_REPRODUCTION_STATUS]: 'redacted' };
  return {
    [ATTR.APP_ERROR_REPRODUCTION_STATUS]: 'available',
    [ATTR.APP_ERROR_REPRODUCTION_FORMAT]: reproduction.format,
    [ATTR.APP_ERROR_REPRODUCTION]: encoded,
  };
}

function rejectionReason(
  error: unknown
): 'too_large' | 'redacted' | 'unsupported' {
  try {
    if (
      error instanceof Error &&
      (error.message === 'too_large' || error.message === 'redacted')
    )
      return error.message;
  } catch {
    /* A hostile thrown value cannot replace the original product failure. */
  }
  return 'unsupported';
}

function consume(budget: Budget, count: number): void {
  budget.remaining -= count;
  if (budget.remaining < 0) throw new Error('too_large');
}

function validate(
  value: unknown,
  budget: Budget,
  ancestors: Set<object>,
  depth: number
): void {
  if (--budget.nodes < 0 || depth > 32) throw new Error('too_large');
  consume(budget, 2);
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    consume(budget, value.length);
    return;
  }
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    !Object.is(value, -0)
  )
    return;
  if (typeof value !== 'object' || value === null)
    throw new Error('unsupported');
  validateObject(value, budget, ancestors, depth);
}

function validateObject(
  value: object,
  budget: Budget,
  ancestors: Set<object>,
  depth: number
): void {
  if (ancestors.has(value)) throw new Error('unsupported');
  const prototype = Object.getPrototypeOf(value);
  if (
    !Array.isArray(value) &&
    prototype !== Object.prototype &&
    prototype !== null
  )
    throw new Error('unsupported');
  if (Array.isArray(value) && value.length > budget.nodes)
    throw new Error('too_large');
  const keys = Reflect.ownKeys(value);
  if (keys.length > budget.nodes + 1) throw new Error('too_large');
  if (Array.isArray(value) && keys.length !== value.length + 1)
    throw new Error('unsupported');
  ancestors.add(value);
  try {
    for (const key of keys) {
      if (Array.isArray(value) && key === 'length') continue;
      const property = jsonProperty(value, key);
      consume(budget, property.key.length + 2);
      validate(property.value, budget, ancestors, depth + 1);
    }
  } finally {
    ancestors.delete(value);
  }
}

function jsonProperty(
  value: object,
  key: string | symbol
): { key: string; value: unknown } {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (
    typeof key !== 'string' ||
    descriptor?.enumerable !== true ||
    !('value' in descriptor)
  )
    throw new Error('unsupported');
  if (CREDENTIAL_KEYS.has(key.replace(/[._-]/g, '').toLowerCase()))
    throw new Error('redacted');
  if (Array.isArray(value) && !/^(0|[1-9][0-9]*)$/.test(key))
    throw new Error('unsupported');
  return { key, value: descriptor.value };
}
