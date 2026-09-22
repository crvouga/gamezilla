import type {
  NarrateEvent,
  NarrateLink,
  NarrateSpan,
} from '@pkgs/observability/core';

type UnknownMap = Record<string, unknown>;
type Attributes = NarrateSpan['attributes'];
type AttributeValue = Attributes[string];

function object(value: unknown): UnknownMap | undefined {
  return value !== null && typeof value === 'object'
    ? (value as UnknownMap)
    : undefined;
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function otlpTimeMs(value: unknown): number | undefined {
  if (typeof value === 'string') {
    const nanos = Number(value);
    if (Number.isFinite(nanos)) return nanos / 1_000_000;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return number(value);
}

function attrValue(value: unknown): AttributeValue | undefined {
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    return value
      .filter(
        (item): item is string | number | boolean =>
          typeof item === 'string' ||
          typeof item === 'boolean' ||
          (typeof item === 'number' && Number.isFinite(item))
      )
      .map(String);
  }
  const wrapped = object(value);
  if (wrapped === undefined) return undefined;
  return (
    attrValue(wrapped['stringValue']) ??
    attrValue(wrapped['boolValue']) ??
    attrValue(wrapped['intValue']) ??
    attrValue(wrapped['doubleValue'])
  );
}

function attributes(value: unknown): Attributes {
  if (Array.isArray(value)) {
    const out: Attributes = {};
    for (const item of value) {
      const entry = object(item);
      const key = string(entry?.['key']);
      const normalized = attrValue(entry?.['value']);
      if (key !== undefined && normalized !== undefined) out[key] = normalized;
    }
    return out;
  }
  const map = object(value);
  if (map === undefined) return {};
  const out: Attributes = {};
  for (const [key, raw] of Object.entries(map)) {
    const normalized = attrValue(raw);
    if (normalized !== undefined) out[key] = normalized;
  }
  return out;
}

function status(value: unknown): NarrateSpan['status'] {
  const raw = object(value)?.['code'] ?? value;
  if (raw === 2 || raw === 'STATUS_CODE_ERROR' || raw === 'error')
    return 'error';
  if (raw === 1 || raw === 'STATUS_CODE_OK' || raw === 'ok') return 'ok';
  return 'unset';
}

function event(value: unknown): NarrateEvent | undefined {
  const item = object(value);
  const name = string(item?.['name']);
  const timeMs = otlpTimeMs(
    item?.['timeUnixNano'] ?? item?.['timeMs'] ?? item?.['timestamp']
  );
  if (name === undefined || timeMs === undefined) return undefined;
  return { name, timeMs, attributes: attributes(item?.['attributes']) };
}

function link(value: unknown): NarrateLink | undefined {
  const item = object(value);
  const traceId = string(item?.['traceId']);
  const spanId = string(item?.['spanId']);
  if (traceId === undefined || spanId === undefined) return undefined;
  return { traceId, spanId, attributes: attributes(item?.['attributes']) };
}

export function normalizeSpan(value: unknown): NarrateSpan | undefined {
  const item = object(value);
  const traceId = string(item?.['traceId']);
  const spanId = string(item?.['spanId']);
  const name = string(item?.['name']);
  const startTimeMs = otlpTimeMs(
    item?.['startTimeUnixNano'] ?? item?.['startTimeMs'] ?? item?.['timestamp']
  );
  const endTimeMs = otlpTimeMs(
    item?.['endTimeUnixNano'] ?? item?.['endTimeMs']
  );
  const durationMs =
    number(item?.['durationMs']) ??
    (startTimeMs !== undefined && endTimeMs !== undefined
      ? endTimeMs - startTimeMs
      : undefined);
  if (
    traceId === undefined ||
    spanId === undefined ||
    name === undefined ||
    startTimeMs === undefined ||
    durationMs === undefined
  )
    return undefined;
  const rawEvents = Array.isArray(item?.['events']) ? item['events'] : [];
  const rawLinks = Array.isArray(item?.['links']) ? item['links'] : [];
  const spanStatus = item?.['status'];
  const parentSpanId = string(item?.['parentSpanId']);
  const statusMessage = string(
    object(spanStatus)?.['message'] ?? item?.['statusMessage']
  );
  return {
    traceId,
    spanId,
    ...(parentSpanId === undefined ? {} : { parentSpanId }),
    name,
    startTimeMs,
    durationMs,
    status: status(spanStatus),
    ...(statusMessage === undefined ? {} : { statusMessage }),
    attributes: attributes(item?.['attributes']),
    events: rawEvents
      .map(event)
      .filter((item): item is NarrateEvent => item !== undefined),
    links: rawLinks
      .map(link)
      .filter((item): item is NarrateLink => item !== undefined),
  };
}

export function spansFromDocument(value: unknown): NarrateSpan[] {
  const direct = normalizeSpan(value);
  if (direct !== undefined) return [direct];
  const root = object(value);
  const resourceSpans = root?.['resourceSpans'];
  if (!Array.isArray(resourceSpans)) return [];
  const spans: NarrateSpan[] = [];
  for (const resource of resourceSpans) {
    const resourceObject = object(resource);
    const resourceAttributes = attributes(
      object(resourceObject?.['resource'])?.['attributes']
    );
    const scopes = resourceObject?.['scopeSpans'];
    if (!Array.isArray(scopes)) continue;
    for (const scope of scopes) {
      const items = object(scope)?.['spans'];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const normalized = normalizeSpan(item);
        if (normalized !== undefined) {
          spans.push({
            ...normalized,
            attributes: { ...resourceAttributes, ...normalized.attributes },
          });
        }
      }
    }
  }
  return spans;
}
