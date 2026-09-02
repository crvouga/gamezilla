import { canonicalJsonStringify, type JsonValue } from '../../kernel/json';

export type AcmeKvEntry = {
  readonly value: string;
  readonly writeId: number;
};

export function serverEndpointId(): string {
  return 'acme-kv:server';
}

export function clientEndpointId(clientId: string): string {
  return `acme-kv:client:${clientId}`;
}

export function storeSnapshot(
  store: Map<string, AcmeKvEntry>
): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  for (const key of [...store.keys()].sort()) {
    const e = store.get(key)!;
    out[key] = { value: e.value, writeId: e.writeId };
  }
  return out;
}

export function storeFingerprint(store: Map<string, AcmeKvEntry>): string {
  return canonicalJsonStringify(storeSnapshot(store));
}
