/**
 * Helpers for {@link JsonView}: value classification, safe stringification,
 * and path encoding shared across the node renderer and toolbar.
 */

export type JsonValueKind =
  | 'string'
  | 'number'
  | 'bigint'
  | 'boolean'
  | 'null'
  | 'undefined'
  | 'array'
  | 'object'
  | 'function'
  | 'symbol'
  | 'date'
  | 'error'
  | 'circular'
  | 'unknown';

export type JsonPath = ReadonlyArray<string | number>;

const SAFE_REPLACEMENT = '[Circular]';

/** Stable string key for an absolute path (used by the expansion-state map). */
export function encodePath(path: JsonPath): string {
  return JSON.stringify(path);
}

/** Render a path as a `$.foo[0].bar`-style string (for display + copy-as-path). */
export function formatPathLabel(path: JsonPath): string {
  let out = '$';
  for (const segment of path) {
    if (typeof segment === 'number') {
      out += `[${segment.toString()}]`;
    } else if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment)) {
      out += `.${segment}`;
    } else {
      out += `[${JSON.stringify(segment)}]`;
    }
  }
  return out;
}

const PRIMITIVE_KIND_BY_TYPEOF: Partial<Record<string, JsonValueKind>> = {
  string: 'string',
  number: 'number',
  bigint: 'bigint',
  boolean: 'boolean',
  function: 'function',
  symbol: 'symbol',
  undefined: 'undefined',
};

function classifyObjectLike(value: object): JsonValueKind {
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  if (value instanceof Error) return 'error';
  return 'object';
}

export function classifyValue(value: unknown): JsonValueKind {
  if (value === null) return 'null';
  if (typeof value === 'object') return classifyObjectLike(value);
  return PRIMITIVE_KIND_BY_TYPEOF[typeof value] ?? 'unknown';
}

export function isContainer(kind: JsonValueKind): boolean {
  return kind === 'object' || kind === 'array';
}

/**
 * Returns the child entries `(key, value)` for a container in render order.
 * Arrays expose numeric indices, objects expose own enumerable keys (sorted by
 * insertion order, matching `Object.entries`).
 */
export function entriesOf(
  value: unknown,
  kind: JsonValueKind
): Array<[string | number, unknown]> {
  if (kind === 'array' && Array.isArray(value)) {
    return value.map((v, i) => [i, v]);
  }
  if (kind === 'object' && value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>);
  }
  return [];
}

export function containerCount(value: unknown, kind: JsonValueKind): number {
  if (kind === 'array' && Array.isArray(value)) return value.length;
  if (kind === 'object' && value !== null && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length;
  }
  return 0;
}

function formatFunctionPreview(value: unknown): string {
  const fn = value as { name?: string };
  const name =
    typeof fn.name === 'string' && fn.name.length > 0 ? fn.name : 'anonymous';
  return `function ${name}() {…}`;
}

const LEAF_FORMATTERS: Partial<
  Record<JsonValueKind, (value: unknown) => string>
> = {
  string: (v) => JSON.stringify(v),
  number: (v) => String(v),
  boolean: (v) => String(v),
  bigint: (v) => `${(v as bigint).toString()}n`,
  null: () => 'null',
  undefined: () => 'undefined',
  symbol: (v) => (v as symbol).toString(),
  function: formatFunctionPreview,
  date: (v) => `Date(${(v as Date).toISOString()})`,
  error: (v) => `${(v as Error).name}: ${(v as Error).message}`,
  circular: () => SAFE_REPLACEMENT,
};

/** One-line preview shown for a leaf or collapsed container row. */
export function formatLeafPreview(value: unknown, kind: JsonValueKind): string {
  const formatter = LEAF_FORMATTERS[kind];
  return formatter ? formatter(value) : '';
}

/** Summary like `{ 3 keys }` or `[ 5 ]` for a collapsed container. */
export function formatContainerSummary(
  count: number,
  kind: JsonValueKind
): string {
  if (kind === 'array') return count === 1 ? `${count} item` : `${count} items`;
  return count === 1 ? `${count} key` : `${count} keys`;
}

export function containerBrackets(kind: JsonValueKind): {
  open: string;
  close: string;
} {
  return kind === 'array'
    ? { open: '[', close: ']' }
    : { open: '{', close: '}' };
}

const UNDEFINED_PLACEHOLDER = '__undefined__placeholder__';

function safeStringifyPrimitive(raw: unknown): string | undefined {
  if (raw === undefined) return UNDEFINED_PLACEHOLDER;
  if (typeof raw === 'bigint') return `${raw.toString()}n`;
  if (typeof raw === 'symbol') return raw.toString();
  if (typeof raw === 'function') {
    const name = (raw as { name?: string }).name ?? '';
    return `[Function ${name}]`.trim();
  }
  return undefined;
}

function safeStringifyObjectLike(raw: object): string | undefined {
  if (raw instanceof Error) return `${raw.name}: ${raw.message}`;
  if (raw instanceof Date) return raw.toISOString();
  return undefined;
}

function makeSafeReplacer(): (key: string, value: unknown) => unknown {
  const seen = new WeakSet<object>();
  return (_key, raw) => {
    const primitive = safeStringifyPrimitive(raw);
    if (primitive !== undefined) return primitive;
    if (raw !== null && typeof raw === 'object') {
      const objectLike = safeStringifyObjectLike(raw);
      if (objectLike !== undefined) return objectLike;
      if (seen.has(raw)) return SAFE_REPLACEMENT;
      seen.add(raw);
    }
    return raw;
  };
}

/**
 * Stringify any value into pretty JSON, replacing circular references and
 * non-JSON values (BigInt, Function, Symbol, Date, Error) with stable strings.
 * Never throws.
 */
export function safeStringify(value: unknown, indent = 2): string {
  try {
    return JSON.stringify(value, makeSafeReplacer(), indent).replace(
      new RegExp(`"${UNDEFINED_PLACEHOLDER}"`, 'g'),
      'null'
    );
  } catch {
    try {
      return String(value);
    } catch {
      return SAFE_REPLACEMENT;
    }
  }
}

/**
 * Walks the whole tree and returns every container path encoded with
 * {@link encodePath}. Used by "Expand all" and to seed the initial expansion
 * map when a fixed depth isn't enough.
 */
export function collectAllContainerPaths(
  root: unknown,
  options: { maxDepth?: number } = {}
): string[] {
  const maxDepth = options.maxDepth ?? Infinity;
  const out: string[] = [];
  const seen = new WeakSet<object>();
  const visit = (value: unknown, path: JsonPath, depth: number): void => {
    const kind = classifyValue(value);
    if (!isContainer(kind)) return;
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return;
      seen.add(value);
    }
    out.push(encodePath(path));
    if (depth >= maxDepth) return;
    for (const [k, v] of entriesOf(value, kind)) {
      visit(v, [...path, k], depth + 1);
    }
  };
  visit(root, [], 0);
  return out;
}
