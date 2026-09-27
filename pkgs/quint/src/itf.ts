/**
 * The Informal Trace Format (ITF) Quint writes with `--out-itf`, decoded into
 * plain JS values, and one rendering of those values that is both what a
 * failure prints and what two values are compared by.
 *
 *   ITF                         JS
 *   true / "s" / 3              boolean / string / number
 *   {"#bigint": "123"}          number (bigint beyond the safe range)
 *   {"#tup": [a, b]}            [a, b]            (readonly array)
 *   {"#set": [a, b]}            Set
 *   {"#map": [[k, v], …]}       Map
 *   {"tag": "T", "value": v}    { tag: 'T', value: v }   (a variant)
 *   {"f": v, …}                 { f: v, … }       (a record)
 *
 * https://apalache-mc.org/docs/adr/015adr-trace.html
 */

export type QuintValue =
  | boolean
  | string
  | number
  | bigint
  | readonly QuintValue[]
  | ReadonlySet<QuintValue>
  | ReadonlyMap<QuintValue, QuintValue>
  | { readonly [field: string]: QuintValue };

type Json =
  | null
  | boolean
  | number
  | string
  | readonly Json[]
  | { readonly [key: string]: Json };

function isObject(value: Json): value is { readonly [key: string]: Json } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function only(value: { readonly [key: string]: Json }, key: string): boolean {
  const keys = Object.keys(value);
  return keys.length === 1 && keys[0] === key;
}

function list(value: Json | undefined, what: string): readonly Json[] {
  if (!Array.isArray(value)) throw new Error(`itf: ${what} is not a list`);
  return value as readonly Json[];
}

export function decodeItfValue(value: Json): QuintValue {
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') return value;
  if (value === null) throw new Error('itf: null is not a Quint value');
  if (Array.isArray(value)) {
    throw new Error('itf: a bare list is not a Quint value');
  }
  const obj = value as { readonly [key: string]: Json };
  if (only(obj, '#bigint')) {
    const big = BigInt(String(obj['#bigint']));
    return big >= BigInt(Number.MIN_SAFE_INTEGER) &&
      big <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(big)
      : big;
  }
  if (only(obj, '#tup')) return list(obj['#tup'], '#tup').map(decodeItfValue);
  if (only(obj, '#set')) {
    return new Set(list(obj['#set'], '#set').map(decodeItfValue));
  }
  if (only(obj, '#map')) {
    return new Map(
      list(obj['#map'], '#map').map((pair) => {
        const [k, v] = list(pair, '#map entry');
        if (k === undefined || v === undefined) {
          throw new Error('itf: #map entry is not a pair');
        }
        return [decodeItfValue(k), decodeItfValue(v)] as const;
      })
    );
  }
  if (only(obj, '#unserializable')) {
    throw new Error(
      `itf: unserializable value ${String(obj['#unserializable'])}`
    );
  }
  const record: { [field: string]: QuintValue } = {};
  for (const [field, inner] of Object.entries(obj)) {
    record[field] = decodeItfValue(inner);
  }
  return record;
}

function isVariant(
  value: object
): value is { readonly tag: string; readonly value: QuintValue } {
  const keys = Object.keys(value);
  return (
    keys.length === 2 &&
    keys.includes('tag') &&
    keys.includes('value') &&
    typeof (value as { tag: unknown }).tag === 'string'
  );
}

function isUnit(value: QuintValue): boolean {
  return Array.isArray(value) && value.length === 0;
}

/**
 * Quint syntax for a value, with set elements and map entries sorted, so two
 * values are equal exactly when they render the same.
 */
export function renderQuint(value: QuintValue): string {
  // Quint has no null; a product read can still return one (a missing
  // field). It renders as itself, so it differs from every model value.
  const raw: unknown = value;
  if (raw === null || raw === undefined) return String(raw);
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) {
    return `(${(value as readonly QuintValue[]).map(renderQuint).join(', ')})`;
  }
  if (value instanceof Set) {
    const items = [...(value as ReadonlySet<QuintValue>)].map(renderQuint);
    return `Set(${items.sort().join(', ')})`;
  }
  if (value instanceof Map) {
    const entries = [...(value as ReadonlyMap<QuintValue, QuintValue>)].map(
      ([k, v]) => `${renderQuint(k)} -> ${renderQuint(v)}`
    );
    return `Map(${entries.sort().join(', ')})`;
  }
  const obj = value as { readonly [field: string]: QuintValue };
  if (isVariant(obj)) {
    return isUnit(obj.value)
      ? obj.tag
      : `${obj.tag}(${renderQuint(obj.value)})`;
  }
  const fields = Object.keys(obj)
    .sort()
    .map((field) => `${field}: ${renderQuint(obj[field] as QuintValue)}`);
  return `{ ${fields.join(', ')} }`;
}

export function quintEqual(a: QuintValue, b: QuintValue): boolean {
  return renderQuint(a) === renderQuint(b);
}

/** A variant value, as a binding's `observe` builds one. */
export function variant(tag: string, value: QuintValue = []): QuintValue {
  return { tag, value };
}

export type ItfState = {
  /** `mbt::actionTaken`: the action Quint took to reach this state. */
  readonly action: string;
  /** `mbt::nondetPicks`: the nondeterministic values it drew (`Some` only). */
  readonly picks: Readonly<Record<string, QuintValue>>;
  /** The model's state variables. */
  readonly vars: Readonly<Record<string, QuintValue>>;
};

export type ItfTrace = {
  readonly vars: readonly string[];
  readonly states: readonly ItfState[];
};

const ACTION_TAKEN = 'mbt::actionTaken';
const NONDET_PICKS = 'mbt::nondetPicks';

function decodePicks(raw: Json | undefined): Record<string, QuintValue> {
  if (raw === undefined || !isObject(raw)) return {};
  const picks: Record<string, QuintValue> = {};
  for (const [name, option] of Object.entries(raw)) {
    if (isObject(option) && option['tag'] === 'Some') {
      picks[name] = decodeItfValue(option['value'] ?? null);
    }
  }
  return picks;
}

/** Decode one `--mbt --out-itf` trace file's JSON. */
export function decodeItfTrace(json: unknown): ItfTrace {
  if (typeof json !== 'object' || json === null) {
    throw new Error('itf: trace is not an object');
  }
  const raw = json as { readonly vars?: Json; readonly states?: Json };
  const vars = list(raw.vars, 'vars').map(String);
  const modelVars = vars.filter((name) => !name.startsWith('mbt::'));
  if (!vars.includes(ACTION_TAKEN)) {
    throw new Error(
      'itf: trace has no mbt::actionTaken — run quint with --mbt'
    );
  }
  const states = list(raw.states, 'states').map((state) => {
    if (!isObject(state)) throw new Error('itf: a state is not an object');
    const values: Record<string, QuintValue> = {};
    for (const name of modelVars) {
      const inner = state[name];
      if (inner === undefined) throw new Error(`itf: state lacks ${name}`);
      values[name] = decodeItfValue(inner);
    }
    return {
      action: String(state[ACTION_TAKEN]),
      picks: decodePicks(state[NONDET_PICKS]),
      vars: values,
    };
  });
  return { vars: modelVars, states };
}
