import { canonicalJsonStringify, type JsonValue } from '../../kernel/json';

export type AcmeKvEntry = {
  readonly value: string;
  readonly writeId: number;
};

export function storeFingerprint(store: Map<string, AcmeKvEntry>): string {
  const out: Record<string, JsonValue> = {};
  for (const key of [...store.keys()].sort()) {
    const e = store.get(key)!;
    out[key] = { value: e.value, writeId: e.writeId };
  }
  return canonicalJsonStringify(out);
}
