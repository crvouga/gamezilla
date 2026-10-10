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

export function allowlistedAttributes(
  attributes: Attributes,
  additionalKeys: ReadonlySet<string> = new Set()
): Attributes {
  const redacted: Attributes = {};
  const redact = createAllowlistRedactor(additionalKeys);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined) continue;
    const replacement = redact(key, value);
    if (replacement !== undefined) redacted[key] = replacement;
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
    .replace(/([?&](?:token|key|secret|password)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email-redacted]');
  return withoutCredentials.length <= limit
    ? withoutCredentials
    : `${withoutCredentials.slice(0, Math.max(0, limit - 12))}…[truncated]`;
}
