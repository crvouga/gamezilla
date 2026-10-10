import { ATTR } from './attributes';
import { validateEvent } from './event-contract';
import { allowlistedAttributes } from './redaction';
import { WEB_VITAL_EVENT } from './web-vital';

type RecordValue = Record<string, unknown>;
const VITAL_UNITS: Readonly<Record<string, string>> = {
  'web.vital.inp': 'ms',
  'web.vital.lcp': 'ms',
  'web.vital.cls': '1',
};
const LOG_KEYS = new Set<string>([
  ATTR.EXCEPTION_TYPE,
  ATTR.EXCEPTION_MESSAGE,
  ATTR.EXCEPTION_STACKTRACE,
  ATTR.APP_LOG_MESSAGE,
  ATTR.APP_LOG_NAME,
  ATTR.APP_BUILD_SHA,
  ATTR.APP_ERROR_TRACE_ID,
]);

/** Browser ingestion cannot forge authoritative resources or business events.
 * Accept diagnostic JSON only; never forward arbitrary log bodies. */
export function sanitizeBrowserOtlp(
  input: unknown,
  signal: 'logs' | 'metrics',
  identity: {
    readonly serviceName: string;
    readonly environment: string;
  }
): unknown | undefined {
  if (!record(input)) return undefined;
  const key = signal === 'logs' ? 'resourceLogs' : 'resourceMetrics';
  const resources = input[key];
  if (!Array.isArray(resources) || resources.length > 32) return undefined;
  const scopeKey = signal === 'logs' ? 'scopeLogs' : 'scopeMetrics';
  const safe = resources.map((resource) => {
    if (
      !record(resource) ||
      !Array.isArray(resource[scopeKey]) ||
      resource[scopeKey].length > 32
    )
      throw new Error('Invalid OTLP scopes');
    return {
      resource: {
        attributes: [
          {
            key: ATTR.SERVICE_NAME,
            value: { stringValue: identity.serviceName },
          },
          {
            key: ATTR.DEPLOYMENT_ENVIRONMENT_NAME,
            value: { stringValue: identity.environment },
          },
        ],
      },
      [scopeKey]: resource[scopeKey].map((scope: unknown) =>
        sanitizeScope(scope, signal)
      ),
    };
  });
  return { [key]: safe };
}

function sanitizeScope(input: unknown, signal: 'logs' | 'metrics'): unknown {
  if (!record(input)) throw new Error('Invalid OTLP scope');
  const key = signal === 'logs' ? 'logRecords' : 'metrics';
  const records = input[key];
  if (!Array.isArray(records) || records.length > 200)
    throw new Error('Invalid OTLP records');
  return {
    scope: { name: '@pkgs/observability' },
    [key]: records.flatMap((entry) => {
      if (!record(entry)) throw new Error('Invalid OTLP record');
      const safe =
        signal === 'logs' ? sanitizeLog(entry) : sanitizeMetric(entry);
      return safe === undefined ? [] : [safe];
    }),
  };
}

function sanitizeLog(input: RecordValue): unknown {
  if (input['eventName'] === WEB_VITAL_EVENT.name) return sanitizeVital(input);
  const attributes: Record<string, string> = {};
  for (const item of Array.isArray(input['attributes'])
    ? input['attributes'].slice(0, 32)
    : []) {
    if (
      !record(item) ||
      typeof item['key'] !== 'string' ||
      !LOG_KEYS.has(item['key']) ||
      !record(item['value'])
    )
      continue;
    if (typeof item['value']['stringValue'] === 'string')
      attributes[item['key']] = item['value']['stringValue'];
  }
  const safe = allowlistedAttributes(attributes);
  return {
    body: { stringValue: 'diagnostic' },
    ...safeLogContext(input),
    attributes: Object.entries(safe).map(([key, value]) => ({
      key,
      value: { stringValue: value },
    })),
  };
}

function sanitizeVital(input: RecordValue): unknown {
  const attributes: RecordValue = {};
  for (const item of Array.isArray(input['attributes'])
    ? input['attributes'].slice(0, 32)
    : []) {
    if (
      !record(item) ||
      typeof item['key'] !== 'string' ||
      !record(item['value'])
    )
      continue;
    const key = item['key'];
    if (!Object.hasOwn(WEB_VITAL_EVENT.attributes, key)) continue;
    const value = item['value'];
    attributes[key] =
      value['stringValue'] ??
      value['doubleValue'] ??
      otlpInteger(value['intValue']);
  }
  if (!validateEvent(WEB_VITAL_EVENT, attributes))
    throw new Error('Invalid Web Vital observation');
  return {
    ...safeLogContext(input),
    eventName: WEB_VITAL_EVENT.name,
    body: { stringValue: WEB_VITAL_EVENT.name },
    attributes: Object.entries(attributes).map(([key, value]) => ({
      key,
      value:
        typeof value === 'number'
          ? { doubleValue: value }
          : { stringValue: value },
    })),
  };
}

function otlpInteger(input: unknown): number | undefined {
  if (
    typeof input !== 'number' &&
    !(typeof input === 'string' && /^\d{1,16}$/.test(input))
  )
    return undefined;
  const value = Number(input);
  return Number.isSafeInteger(value) ? value : undefined;
}

function safeLogContext(input: RecordValue): RecordValue {
  const safe: RecordValue = {};
  for (const key of [
    'timeUnixNano',
    'observedTimeUnixNano',
    'startTimeUnixNano',
  ])
    if (typeof input[key] === 'string' && /^\d{1,20}$/.test(input[key]))
      safe[key] = input[key];
  for (const [key, length] of [
    ['traceId', 32],
    ['spanId', 16],
  ] as const)
    if (
      typeof input[key] === 'string' &&
      new RegExp(`^[a-f0-9]{${length}}$`).test(input[key])
    )
      safe[key] = input[key];
  if (
    typeof input['severityNumber'] === 'number' &&
    Number.isInteger(input['severityNumber']) &&
    input['severityNumber'] >= 0 &&
    input['severityNumber'] <= 24
  )
    safe['severityNumber'] = input['severityNumber'];
  if (typeof safe['severityNumber'] === 'number')
    safe['severityText'] =
      ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'][
        Math.floor((safe['severityNumber'] - 1) / 4)
      ] ?? 'UNSPECIFIED';
  return safe;
}

function sanitizeMetric(input: RecordValue): unknown | undefined {
  const name = input['name'];
  if (typeof name !== 'string' || !Object.hasOwn(VITAL_UNITS, name))
    return undefined;
  const histogram = input['histogram'];
  if (
    !record(histogram) ||
    !Array.isArray(histogram['dataPoints']) ||
    histogram['dataPoints'].length > 64
  )
    throw new Error('Invalid Web Vital histogram');
  return {
    name,
    unit: VITAL_UNITS[name],
    histogram: {
      aggregationTemporality: histogram['aggregationTemporality'] === 1 ? 1 : 2,
      dataPoints: histogram['dataPoints'].map(sanitizePoint),
    },
  };
}

function sanitizePoint(input: unknown): unknown {
  if (!record(input)) throw new Error('Invalid metric point');
  const count = Number(input['count']);
  const bounds = input['explicitBounds'];
  const buckets = input['bucketCounts'];
  if (
    !Number.isSafeInteger(count) ||
    count < 0 ||
    typeof input['sum'] !== 'number' ||
    !Number.isFinite(input['sum']) ||
    input['sum'] < 0 ||
    !Array.isArray(bounds) ||
    bounds.length > 64 ||
    !Array.isArray(buckets) ||
    buckets.length !== bounds.length + 1 ||
    !bounds.every(
      (value, index) =>
        typeof value === 'number' &&
        Number.isFinite(value) &&
        (index === 0 || value > Number(bounds[index - 1]))
    ) ||
    !buckets.every(
      (value) => Number.isSafeInteger(Number(value)) && Number(value) >= 0
    ) ||
    buckets.reduce<number>((total, value) => total + Number(value), 0) !== count
  )
    throw new Error('Invalid metric histogram');
  return {
    ...safeLogContext(input),
    count: input['count'],
    sum: input['sum'],
    explicitBounds: bounds,
    bucketCounts: buckets,
  };
}

function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
