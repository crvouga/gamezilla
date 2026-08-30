export type QueryBatchItem = {
  readonly name: string;
  readonly params: unknown;
  readonly lastHash?: string;
  readonly checkpoint?: string;
};

export type QueryBatchBody = {
  readonly queries: readonly QueryBatchItem[];
};

export type MutationBatchItem = {
  readonly id: string;
  readonly name: string;
  readonly args: string;
  readonly clientId: string;
  readonly seq: number;
  readonly createdAt: string;
};

export type MutationsBatchBody = {
  readonly mutations: readonly MutationBatchItem[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function optionalString(
  value: unknown
): { ok: true; value: string | undefined } | { ok: false } {
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value === 'string') return { ok: true, value };
  return { ok: false };
}

function parseQueryItem(value: unknown): QueryBatchItem | null {
  if (!isPlainObject(value)) return null;
  const name = value['name'];
  if (typeof name !== 'string' || name.length < 1) return null;
  const lastHash = optionalString(value['lastHash']);
  if (!lastHash.ok) return null;
  const checkpoint = optionalString(value['checkpoint']);
  if (!checkpoint.ok) return null;
  const item: QueryBatchItem = {
    name,
    params: value['params'] === undefined ? {} : value['params'],
    ...(lastHash.value !== undefined ? { lastHash: lastHash.value } : {}),
    ...(checkpoint.value !== undefined ? { checkpoint: checkpoint.value } : {}),
  };
  return item;
}

/** Parse POST /query body. Returns null on invalid shape. */
export function parseQueryBatchBody(value: unknown): QueryBatchBody | null {
  if (!isPlainObject(value)) return null;
  const queries = value['queries'];
  if (!Array.isArray(queries) || queries.length < 1 || queries.length > 64) {
    return null;
  }
  const items: QueryBatchItem[] = [];
  for (const q of queries) {
    const item = parseQueryItem(q);
    if (item === null) return null;
    items.push(item);
  }
  return { queries: items };
}

function parseMutationItem(value: unknown): MutationBatchItem | null {
  if (!isPlainObject(value)) return null;
  const id = value['id'];
  const name = value['name'];
  const args = value['args'];
  const clientId = value['clientId'];
  const seq = value['seq'];
  const createdAt = value['createdAt'];
  if (typeof id !== 'string' || id.length < 1) return null;
  if (typeof name !== 'string' || name.length < 1) return null;
  if (typeof args !== 'string') return null;
  if (typeof clientId !== 'string' || clientId.length < 1) return null;
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0) return null;
  if (typeof createdAt !== 'string' || createdAt.length < 1) return null;
  return { id, name, args, clientId, seq, createdAt };
}

/**
 * Parse POST /mutations body. Returns null on invalid shape.
 * Batch size limits are enforced by the route (413).
 */
export function parseMutationsBatchBody(
  value: unknown
): MutationsBatchBody | null {
  if (!isPlainObject(value)) return null;
  const mutations = value['mutations'];
  if (!Array.isArray(mutations)) return null;
  const items: MutationBatchItem[] = [];
  for (const m of mutations) {
    const item = parseMutationItem(m);
    if (item === null) return null;
    items.push(item);
  }
  return { mutations: items };
}
