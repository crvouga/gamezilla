/**
 * The conformance manifest: what the product is and what must be proven
 * automatically before a release of it is called ready (a repository's
 * `specs/conformance.yaml`). Keys are the manifest's own words, spaces
 * included (`decided by`, `public contracts`), so the model reads like the
 * file.
 *
 * `parseManifest` reads it strictly: an unknown or missing key, a duplicate
 * id, a capability or contract in an undeclared context, a kind of spec that
 * is not `required`, `manual testing allowed` other than `false`, or a
 * `fail on` that does not name every non-pass state is an issue. A manifest
 * that does not read cleanly is never half-read.
 */

/** Every kind of specification a manifest must require (its `conformance` keys). */
export const CONFORMANCE_KINDS = [
  'behavior',
  'decisions',
  'dynamics',
  'structure',
  'objectives',
  'accessibility',
] as const;
export type ConformanceKind = (typeof CONFORMANCE_KINDS)[number];

/** The evidence classes a production-readiness verdict can require. */
export const REQUIREMENTS = [
  'specification validity',
  'implementation conformance',
  'permission enforcement',
  'assembled system acceptance',
  'accessibility conformance',
  'production-safe synthetics',
  'quality objectives',
  'release engineering gates',
  'completeness',
] as const;
export type Requirement = (typeof REQUIREMENTS)[number];

/** Every state that is not a machine-evidenced pass; `fail on` lists all of them. */
export const FAIL_STATES = [
  'manual',
  'unknown',
  'skipped',
  'not run',
  'missing evidence',
  'stale evidence',
  'missing automation',
] as const;
export type FailState = (typeof FAIL_STATES)[number];

export type Capability = {
  readonly id: string;
  readonly context: string;
  /** The decision (table id) that answers whether a person may do it. */
  readonly 'decided by': string;
};

export type PublicContract = {
  readonly id: string;
  readonly context: string;
  readonly promise: string;
};

export type Environment = {
  readonly id: string;
  readonly promise: string;
};

export type ProductionReadiness = {
  readonly 'manual testing allowed': false;
  readonly require: readonly Requirement[];
  readonly 'fail on': readonly FailState[];
};

export type ConformanceManifest = {
  readonly product: {
    readonly contexts: readonly string[];
    readonly tiers: readonly string[];
    readonly capabilities: readonly Capability[];
    readonly 'public contracts': readonly PublicContract[];
  };
  readonly conformance: Readonly<Record<ConformanceKind, 'required'>>;
  readonly environments: readonly Environment[];
  readonly 'production readiness': ProductionReadiness;
  readonly 'release gates': readonly string[];
};

export type ParsedManifest =
  | { readonly ok: true; readonly manifest: ConformanceManifest }
  | { readonly ok: false; readonly issues: readonly string[] };

type Mapping = Readonly<Record<string, unknown>>;

/** Where a value is, and where its problems go. */
type At = { readonly path: string; readonly issues: string[] };

function at(parent: At, key: string | number): At {
  const path =
    typeof key === 'number'
      ? `${parent.path}[${String(key)}]`
      : parent.path === ''
        ? key
        : `${parent.path}.${key}`;
  return {
    path,
    issues: parent.issues,
  };
}

function report(where: At, message: string): void {
  where.issues.push(
    `${where.path === '' ? 'the manifest' : where.path}: ${message}`
  );
}

function isMapping(value: unknown): value is Mapping {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The mapping at `where` with exactly `keys`, or null (reported). */
function mapping(
  where: At,
  value: unknown,
  keys: readonly string[]
): Mapping | null {
  if (!isMapping(value)) {
    // A missing key is reported once, by the mapping that should hold it.
    if (value !== undefined) {
      report(where, `must be a mapping with ${keys.join(', ')}`);
    }
    return null;
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) {
      report(at(where, key), `is not a manifest key (${keys.join(', ')})`);
    }
  }
  for (const key of keys) {
    if (!(key in value)) report(at(where, key), 'is missing');
  }
  return value;
}

function text(where: At, value: unknown): string {
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (value !== undefined) report(where, 'must be non-empty text');
  return '';
}

function list(where: At, value: unknown): readonly unknown[] {
  if (Array.isArray(value)) return value;
  if (value !== undefined) report(where, 'must be a list');
  return [];
}

function unique(where: At, ids: readonly string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (id === '') continue;
    if (seen.has(id)) report(where, `"${id}" is listed twice`);
    seen.add(id);
  }
}

/** A non-empty list of distinct, non-empty texts. */
function texts(where: At, value: unknown): readonly string[] {
  const items = list(where, value);
  if (Array.isArray(value) && items.length === 0) report(where, 'is empty');
  const out = items.map((item, i) => text(at(where, i), item));
  unique(where, out);
  return out;
}

/** A non-empty list of mappings with exactly `keys`, each read by `read`, ids distinct. */
function records<T extends { readonly id: string }>(
  where: At,
  value: unknown,
  keys: readonly string[],
  read: (entry: Mapping, here: At) => T
): readonly T[] {
  const items = list(where, value);
  if (Array.isArray(value) && items.length === 0) report(where, 'is empty');
  const out: T[] = [];
  for (const [i, item] of items.entries()) {
    const here = at(where, i);
    const entry = mapping(here, item, keys);
    if (entry !== null) out.push(read(entry, here));
  }
  unique(
    where,
    out.map((entry) => entry.id)
  );
  return out;
}

function known<T extends string>(
  where: At,
  value: string,
  allowed: readonly T[]
): value is T {
  if ((allowed as readonly string[]).includes(value)) return true;
  report(
    where,
    `"${value}" is not one of ${allowed.map((a) => `"${a}"`).join(', ')}`
  );
  return false;
}

function inContexts(
  where: At,
  context: string,
  contexts: readonly string[]
): void {
  if (context !== '' && !contexts.includes(context)) {
    report(where, `"${context}" is not one of product.contexts`);
  }
}

function readProduct(
  where: At,
  value: unknown
): ConformanceManifest['product'] {
  const product = mapping(where, value, [
    'contexts',
    'tiers',
    'capabilities',
    'public contracts',
  ]);
  const contexts = texts(at(where, 'contexts'), product?.['contexts']);
  const capabilities = records(
    at(where, 'capabilities'),
    product?.['capabilities'],
    ['id', 'context', 'decided by'],
    (entry, here): Capability => {
      const context = text(at(here, 'context'), entry['context']);
      inContexts(at(here, 'context'), context, contexts);
      return {
        id: text(at(here, 'id'), entry['id']),
        context,
        'decided by': text(at(here, 'decided by'), entry['decided by']),
      };
    }
  );
  const contracts = records(
    at(where, 'public contracts'),
    product?.['public contracts'],
    ['id', 'context', 'promise'],
    (entry, here): PublicContract => {
      const context = text(at(here, 'context'), entry['context']);
      inContexts(at(here, 'context'), context, contexts);
      return {
        id: text(at(here, 'id'), entry['id']),
        context,
        promise: text(at(here, 'promise'), entry['promise']),
      };
    }
  );
  return {
    contexts,
    tiers: texts(at(where, 'tiers'), product?.['tiers']),
    capabilities,
    'public contracts': contracts,
  };
}

function readConformance(
  where: At,
  value: unknown
): ConformanceManifest['conformance'] {
  const conformance = mapping(where, value, CONFORMANCE_KINDS);
  for (const kind of CONFORMANCE_KINDS) {
    const level = conformance?.[kind];
    if (level !== undefined && level !== 'required') {
      report(
        at(where, kind),
        `must be "required", not ${JSON.stringify(level)}`
      );
    }
  }
  return Object.fromEntries(
    CONFORMANCE_KINDS.map((kind) => [kind, 'required'])
  ) as Record<ConformanceKind, 'required'>;
}

function readReadiness(where: At, value: unknown): ProductionReadiness {
  const readiness = mapping(where, value, [
    'manual testing allowed',
    'require',
    'fail on',
  ]);
  const manual = readiness?.['manual testing allowed'];
  if (readiness !== null && manual !== false) {
    report(
      at(where, 'manual testing allowed'),
      `must be false — nothing is verified by hand (got ${JSON.stringify(manual) ?? 'nothing'})`
    );
  }
  const require = texts(at(where, 'require'), readiness?.['require']).filter(
    (id, i) => known(at(at(where, 'require'), i), id, REQUIREMENTS)
  ) as Requirement[];
  const failOn = texts(at(where, 'fail on'), readiness?.['fail on']).filter(
    (state, i) => known(at(at(where, 'fail on'), i), state, FAIL_STATES)
  ) as FailState[];
  if (readiness !== null && Array.isArray(readiness['fail on'])) {
    for (const state of FAIL_STATES) {
      if (!failOn.includes(state)) {
        report(at(where, 'fail on'), `must list "${state}" — it is not a pass`);
      }
    }
  }
  return { 'manual testing allowed': false, require, 'fail on': failOn };
}

const TOP_KEYS = [
  'product',
  'conformance',
  'environments',
  'production readiness',
  'release gates',
] as const;

/** Read a manifest's YAML text; every problem found is an issue. */
export function parseManifest(source: string): ParsedManifest {
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(source);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return { ok: false, issues: [`the manifest is not YAML: ${message}`] };
  }
  const root: At = { path: '', issues: [] };
  if (parsed === null || parsed === undefined) {
    return { ok: false, issues: ['the manifest is empty'] };
  }
  const top = mapping(root, parsed, TOP_KEYS);
  const manifest: ConformanceManifest = {
    product: readProduct(at(root, 'product'), top?.['product']),
    conformance: readConformance(at(root, 'conformance'), top?.['conformance']),
    environments: records(
      at(root, 'environments'),
      top?.['environments'],
      ['id', 'promise'],
      (entry, here): Environment => ({
        id: text(at(here, 'id'), entry['id']),
        promise: text(at(here, 'promise'), entry['promise']),
      })
    ),
    'production readiness': readReadiness(
      at(root, 'production readiness'),
      top?.['production readiness']
    ),
    'release gates': texts(at(root, 'release gates'), top?.['release gates']),
  };
  return root.issues.length > 0
    ? { ok: false, issues: root.issues }
    : { ok: true, manifest };
}
