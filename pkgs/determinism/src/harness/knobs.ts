import type { Arbitrary } from 'fast-check';
import {
  assertJsonValue,
  canonicalJsonStringify,
  type JsonValue,
} from '../kernel/json';

export type KnobDef<T extends JsonValue = JsonValue> = {
  readonly default: T;
  readonly arb: Arbitrary<T>;
  readonly description?: string;
};

export type KnobDefWithId<T extends JsonValue = JsonValue> = KnobDef<T> & {
  readonly id: string;
};

export function knob<T extends JsonValue>(
  defaultValue: T,
  arb: Arbitrary<T>,
  description?: string
): KnobDef<T> {
  return description !== undefined
    ? { default: defaultValue, arb, description }
    : { default: defaultValue, arb };
}

export type KnobValues<K extends Record<string, KnobDef>> = {
  [P in keyof K]: K[P] extends KnobDef<infer V> ? V : JsonValue;
};

export function resolveKnobDefs(
  knobs: Record<string, KnobDef>
): readonly KnobDefWithId[] {
  return Object.entries(knobs).map(([id, def]) => ({ ...def, id }));
}

export function createKnobCatalog<V extends Record<string, JsonValue>>(
  defs: readonly KnobDefWithId[],
  overrides?: Partial<V>
): {
  readonly values: Readonly<V>;
  readonly get: <K extends keyof V & string>(id: K) => V[K];
  readonly toJSON: () => V;
} {
  const seen = new Set<string>();
  const values: Record<string, JsonValue> = {};
  for (const def of defs) {
    if (seen.has(def.id)) {
      throw new Error(`KnobCatalog: duplicate id ${def.id}`);
    }
    seen.add(def.id);
    values[def.id] = assertJsonValue(def.default, `knob.${def.id}.default`);
  }
  if (overrides !== undefined) {
    for (const key of Object.keys(overrides)) {
      if (!seen.has(key)) {
        throw new Error(`KnobCatalog: unknown override key ${key}`);
      }
      values[key] = assertJsonValue(
        overrides[key as keyof V],
        `knob.${key}.override`
      );
    }
  }
  Object.freeze(values);
  return {
    values: values as Readonly<V>,
    get(id) {
      return values[id] as V[typeof id];
    },
    toJSON() {
      return JSON.parse(canonicalJsonStringify(values as JsonValue)) as V;
    },
  };
}
