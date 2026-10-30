import { ATTR } from './attributes';
import { validateEvent } from './event-contract';
import {
  type MetricContract,
  SYNC_DURATION_METRIC,
  SYNC_STARTED_METRIC,
  SYNC_TARGET_METRIC,
} from './metric-contract';
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
          ...browserMetricInstance(resource, signal),
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
        sanitizeScope(scope, signal, identity.environment)
      ),
    };
  });
  return { [key]: safe };
}

const RESOURCE_KEYS_THE_SERVER_OWNS: ReadonlySet<string> = new Set([
  ATTR.SERVICE_NAME,
  ATTR.DEPLOYMENT_ENVIRONMENT_NAME,
]);

/**
 * Browser spans arrive carrying whatever resource the page claims. The page
 * does not know which deployment served it (and a build reports the same name
 * wherever it runs), so the server states the service and environment itself.
 * Spans stay as sent. A body with no `resourceSpans` is left for the collector.
 */
export function stampBrowserTraceResource(
  input: unknown,
  identity: {
    readonly serviceName: string;
    readonly environment: string;
  }
): unknown | undefined {
  if (!record(input)) return undefined;
  const resources = input['resourceSpans'];
  if (!Array.isArray(resources)) return input;
  if (resources.length > 256) return undefined;
  return {
    ...input,
    resourceSpans: resources.map((entry: unknown) => {
      if (!record(entry)) throw new Error('Invalid OTLP resource spans');
      const resource = record(entry['resource']) ? entry['resource'] : {};
      const claimed = Array.isArray(resource['attributes'])
        ? resource['attributes']
        : [];
      return {
        ...entry,
        resource: {
          ...resource,
          attributes: [
            ...claimed.filter(
              (item: unknown) =>
                !record(item) ||
                typeof item['key'] !== 'string' ||
                !RESOURCE_KEYS_THE_SERVER_OWNS.has(item['key'])
            ),
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
      };
    }),
  };
}

function sanitizeScope(
  input: unknown,
  signal: 'logs' | 'metrics',
  environment: string
): unknown {
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
        signal === 'logs'
          ? sanitizeLog(entry)
          : sanitizeMetric(entry, environment);
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

function sanitizeMetric(
  input: RecordValue,
  environment: string
): unknown | undefined {
  const sync = sanitizeSyncMetric(input, environment, sanitizePoint);
  if (sync !== undefined) return sync;
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

/** Cumulative browser writers need distinct opaque resource identities. */
function browserMetricInstance(
  resource: RecordValue,
  signal: 'logs' | 'metrics'
) {
  if (signal !== 'metrics') return [];
  const scopes = resource['scopeMetrics'];
  const hasSync =
    Array.isArray(scopes) &&
    scopes.some(
      (scope) =>
        record(scope) &&
        Array.isArray(scope['metrics']) &&
        scope['metrics'].some(
          (metric) =>
            record(metric) &&
            typeof metric['name'] === 'string' &&
            metric['name'].startsWith('sync.work.')
        )
    );
  if (!hasSync) return [];
  const identity = resource['resource'];
  const attrs = record(identity) ? identity['attributes'] : undefined;
  const instance = Array.isArray(attrs)
    ? attrs.find(
        (attr) => record(attr) && attr['key'] === ATTR.SERVICE_INSTANCE_ID
      )
    : undefined;
  const value =
    record(instance) && record(instance['value'])
      ? instance['value']['stringValue']
      : undefined;
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  )
    throw new Error('Sync metrics require an opaque per-page instance ID');
  return [{ key: ATTR.SERVICE_INSTANCE_ID, value: { stringValue: value } }];
}

type Row = Record<string, unknown>;
const contracts = [
  SYNC_DURATION_METRIC,
  SYNC_STARTED_METRIC,
  SYNC_TARGET_METRIC,
];
const isSyncRecord = (x: unknown): x is Row =>
  x !== null && typeof x === 'object' && !Array.isArray(x);

function dimensions(point: Row, contract: MetricContract, environment: string) {
  const found = new Map<string, string>();
  for (const item of Array.isArray(point['attributes'])
    ? point['attributes']
    : []) {
    if (
      !isSyncRecord(item) ||
      typeof item['key'] !== 'string' ||
      !isSyncRecord(item['value'])
    )
      continue;
    const value = item['value']['stringValue'];
    if (
      typeof value === 'string' &&
      contract.dimensions[item['key']]?.includes(value)
    )
      found.set(item['key'], value);
  }
  if (found.size !== Object.keys(contract.dimensions).length)
    throw new Error('Invalid sync metric dimensions');
  found.set(ATTR.DEPLOYMENT_ENVIRONMENT_NAME, environment);
  return [...found].map(([key, value]) => ({
    key,
    value: { stringValue: value },
  }));
}

function counterPoint(point: Row): Row {
  const value = point['asDouble'] ?? Number(point['asInt']);
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new Error('Invalid sync counter');
  const out: Row = { asDouble: value };
  for (const key of ['timeUnixNano', 'startTimeUnixNano']) {
    const timestamp = point[key];
    if (typeof timestamp !== 'string' || !/^\d{1,20}$/.test(timestamp))
      throw new Error('Invalid metric timestamp');
    out[key] = timestamp;
  }
  return out;
}

/** Only approved finite vocabularies survive; environment is supplied by ingress. */
export function sanitizeSyncMetric(
  input: Row,
  environment: string,
  histogramPoint: (point: unknown) => unknown
): unknown | undefined {
  const contract = contracts.find((c) => c.name === input['name']);
  if (contract === undefined) return undefined;
  const kind = contract.type === 'counter' ? 'sum' : 'histogram';
  const data = input[kind];
  if (
    !isSyncRecord(data) ||
    !Array.isArray(data['dataPoints']) ||
    data['dataPoints'].length > 256
  )
    throw new Error('Invalid sync metric');
  return {
    name: contract.name,
    unit: contract.unit,
    [kind]: {
      aggregationTemporality: data['aggregationTemporality'] === 1 ? 1 : 2,
      ...(kind === 'sum' ? { isMonotonic: true } : {}),
      dataPoints: data['dataPoints'].map((point) => {
        if (!isSyncRecord(point)) throw new Error('Invalid sync metric point');
        return {
          ...(kind === 'sum'
            ? counterPoint(point)
            : (histogramPoint(point) as Row)),
          attributes: dimensions(point, contract, environment),
        };
      }),
    },
  };
}
