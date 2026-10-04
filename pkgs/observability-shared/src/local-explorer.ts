import { IndexedTraceStore } from './indexed';
import type { NarrateSpan } from './narrate';
import { spansFromDocument } from './normalize';

export type QueryFetch = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

const API_PATH = '/cdn-cgi/local/explorer/api';

type ExplorerQuery = {
  readonly bodyKey: string;
  readonly method: string;
  readonly path: string;
  readonly sql: string;
};

export class LocalExplorerTraceStore extends IndexedTraceStore {
  constructor(baseUrl: string, fetchFn: QueryFetch) {
    let cache: Promise<readonly NarrateSpan[]> | undefined;
    super(`local-explorer:${baseUrl}`, () => {
      cache ??= loadLocalExplorer(baseUrl, fetchFn);
      return cache;
    });
  }
}

async function loadLocalExplorer(
  baseUrl: string,
  fetchFn: QueryFetch
): Promise<readonly NarrateSpan[]> {
  const openApiResponse = await fetchFn(`${baseUrl}${API_PATH}`);
  const openApi: unknown = openApiResponse.ok
    ? await openApiResponse.json()
    : null;
  const query = explorerQuery(openApi);
  const response = await fetchFn(`${baseUrl}${API_PATH}${query.path}`, {
    method: query.method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ [query.bodyKey]: query.sql }),
  });
  if (!response.ok)
    throw new Error(`Local Explorer query failed (${String(response.status)})`);
  return explorerSpans(await response.json());
}

function explorerQuery(document: unknown): ExplorerQuery {
  const root = record(document);
  const paths = record(root?.['paths']);
  const path = Object.keys(paths ?? {}).find((candidate) =>
    candidate.endsWith('/observability/query')
  );
  if (path === undefined)
    throw new Error('Local Explorer OpenAPI has no observability query path');
  const pathItem = record(paths?.[path]);
  const method = ['post', 'put'].find(
    (candidate) => record(pathItem?.[candidate]) !== undefined
  );
  if (method === undefined)
    throw new Error('Local Explorer OpenAPI has no supported query operation');
  const operation = record(pathItem?.[method]);
  const schema = requestSchema(root, operation);
  const properties = record(schema?.['properties']);
  const bodyKey = Object.keys(properties ?? {}).find((key) =>
    /^(sql|query)$/i.test(key)
  );
  if (bodyKey === undefined)
    throw new Error('Local Explorer OpenAPI has no SQL request field');
  const example = strings([operation, schema]).find(
    (value) => sqlTable(value) !== null
  );
  const table = example === undefined ? null : sqlTable(example);
  if (table === null)
    throw new Error('Local Explorer OpenAPI does not expose its trace table');
  return {
    bodyKey,
    method: method.toUpperCase(),
    path,
    sql: `SELECT * FROM ${quoteTable(table)} LIMIT 1000`,
  };
}

function requestSchema(
  root: Record<string, unknown> | undefined,
  operation: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  const requestBody = record(operation?.['requestBody']);
  const content = record(requestBody?.['content']);
  const media = record(content?.['application/json']);
  const schema = record(media?.['schema']);
  const reference = schema?.['$ref'];
  if (typeof reference !== 'string' || !reference.startsWith('#/'))
    return schema;
  let current: unknown = root;
  for (const segment of reference.slice(2).split('/')) {
    current =
      record(current)?.[segment.replaceAll('~1', '/').replaceAll('~0', '~')];
  }
  return record(current);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  const item = record(value);
  return item === undefined ? [] : Object.values(item).flatMap(strings);
}

function sqlTable(value: string): string | null {
  return (
    /\bselect\b[\s\S]*?\bfrom\s+([a-z_][a-z0-9_.]*)/i.exec(value)?.[1] ?? null
  );
}

function quoteTable(value: string): string {
  return value
    .split('.')
    .map((part) => `"${part.replaceAll('"', '""')}"`)
    .join('.');
}

function explorerSpans(document: unknown): NarrateSpan[] {
  if (document === null || typeof document !== 'object') return [];
  const result = (document as Record<string, unknown>)['result'];
  if (result === null || typeof result !== 'object')
    return spansFromDocument(document);
  const value = result as Record<string, unknown>;
  const columns = Array.isArray(value['columns'])
    ? value['columns'].map(columnName)
    : [];
  const rows = Array.isArray(value['rows']) ? value['rows'] : [];
  return rows.flatMap((row) => {
    const record = Array.isArray(row)
      ? Object.fromEntries(columns.map((column, index) => [column, row[index]]))
      : row;
    const normalized = normalizeExplorerRow(record);
    return normalized === undefined ? [] : [normalized];
  });
}

function columnName(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value !== null && typeof value === 'object') {
    const name = (value as Record<string, unknown>)['name'];
    if (typeof name === 'string') return name;
  }
  return '';
}

function normalizeExplorerRow(value: unknown): NarrateSpan | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  return spansFromDocument({
    traceId: row['trace_id'] ?? row['traceId'],
    spanId: row['span_id'] ?? row['spanId'],
    parentSpanId: row['parent_span_id'] ?? row['parentSpanId'],
    name: row['name'] ?? row['span_name'],
    startTimeMs:
      row['start_time_ms'] ?? row['startTimeMs'] ?? row['start_time'],
    durationMs: row['duration_ms'] ?? row['durationMs'],
    status: row['status'],
    statusMessage: row['status_message'],
    attributes: row['attributes'],
    events: row['events'],
    links: row['links'],
  })[0];
}
