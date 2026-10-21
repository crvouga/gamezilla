import type { Attributes, AttributeValue } from '@opentelemetry/api';

import { ALLOWED_ATTRIBUTE_KEYS, ATTR } from './attributes';

const VALUE_LIMITS: Readonly<Record<string, number>> = {
  [ATTR.EXCEPTION_TYPE]: 128,
  [ATTR.DB_QUERY_TEXT]: 2_048,
  [ATTR.EXCEPTION_MESSAGE]: 512,
  [ATTR.EXCEPTION_STACKTRACE]: 4_096,
  [ATTR.CODE_FILE_PATH]: 512,
  [ATTR.APP_LOG_MESSAGE]: 512,
  [ATTR.APP_LOG_NAME]: 128,
  [ATTR.APP_INTERACTION_TARGET]: 128,
  [ATTR.APP_DEVICE_TIMEZONE]: 64,
  [ATTR.APP_CLIENT_CITY]: 64,
  [ATTR.APP_CLIENT_REGION]: 64,
  [ATTR.APP_CLIENT_COUNTRY]: 64,
  [ATTR.APP_CLIENT_TIMEZONE]: 64,
};

export type AttributeRedactor = (
  key: string,
  value: AttributeValue
) => AttributeValue | undefined;

/** A primitive an attribute may carry, or one slot of an array value. */
type SafeScalar = string | number | boolean;

/**
 * An attribute value every OTel signal accepts: a primitive or a
 * homogeneous-enough array of them. `@opentelemetry/api` types attribute
 * values as `unknown`; log records require the narrower `AnyValue`, so the
 * redacted map is typed to fit both.
 */
export type SafeAttributeValue = SafeScalar | (SafeScalar | null | undefined)[];

export type SafeAttributes = Record<string, SafeAttributeValue>;

function isSafeScalar(value: unknown): value is SafeScalar {
  return (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function isSafeAttributeValue(value: unknown): value is SafeAttributeValue {
  if (isSafeScalar(value)) return true;
  return (
    Array.isArray(value) &&
    value.every(
      (item) => item === null || item === undefined || isSafeScalar(item)
    )
  );
}

export function allowlistedAttributes(
  attributes: Attributes,
  additionalKeys: ReadonlySet<string> = new Set()
): SafeAttributes {
  const redacted: SafeAttributes = {};
  const redact = createAllowlistRedactor(additionalKeys);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined) continue;
    const replacement = redact(key, value);
    if (isSafeAttributeValue(replacement)) redacted[key] = replacement;
  }
  return redacted;
}

export function createAllowlistRedactor(
  additionalKeys: ReadonlySet<string> = new Set()
): AttributeRedactor {
  return (key, value) => {
    if (!ALLOWED_ATTRIBUTE_KEYS.has(key) && !additionalKeys.has(key)) {
      return undefined;
    }
    const limit = VALUE_LIMITS[key];
    if (limit === undefined) return value;
    if (typeof value === 'string') return redactText(value, limit);
    if (isTextArray(value)) {
      return value.map((item) =>
        typeof item === 'string' ? redactText(item, limit) : item
      );
    }
    return value;
  };
}

function isTextArray(
  value: AttributeValue
): value is (string | null | undefined)[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => typeof item === 'string' || item === null || item === undefined
    )
  );
}

function redactText(value: string, limit: number): string {
  const withoutCredentials = value
    .replace(
      /([?&](?:token|key|secret|password|code|state|ticket|email_link|access_token|refresh_token|id_token|client_secret)=)[^&\s]+/gi,
      '$1[redacted]'
    )
    .replace(
      /(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi,
      '$1[credentials-redacted]@'
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email-redacted]');
  return withoutCredentials.length <= limit
    ? withoutCredentials
    : `${withoutCredentials.slice(0, Math.max(0, limit - 12))}…[truncated]`;
}
