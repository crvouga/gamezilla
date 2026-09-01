import type { Arbitrary } from 'fast-check';
import {
  assertJsonValue,
  canonicalJsonStringify,
  type JsonValue,
} from './json';

export type KnobDef<T extends JsonValue = JsonValue> = {
  readonly id: string;
  readonly default: T;
  readonly arb: Arbitrary<T>;
  readonly description?: string;
};

export function defineKnob<T extends JsonValue>(def: KnobDef<T>): KnobDef<T> {
  return def;
}

export type KnobCatalog<V extends Record<string, JsonValue>> = {
  readonly values: Readonly<V>;
  readonly get: <K extends keyof V & string>(id: K) => V[K];
  readonly toJSON: () => V;
};

export function createKnobCatalog<V extends Record<string, JsonValue>>(
  defs: readonly KnobDef[],
  overrides?: Partial<V>
): KnobCatalog<V> {
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
