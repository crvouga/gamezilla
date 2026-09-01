import { canonicalJsonStringify, type JsonValue } from '../../json';
import type { SimNetwork } from '../../network';

export const ACME_KV_SERVER_KIND = 'acme-kv.server';
export const ACME_KV_CLIENT_KIND = 'acme-kv.client';

export type AcmeKvEntry = {
  readonly value: string;
  readonly writeId: number;
};

/** Mutable bag for the acme-kv test fixture (not a reusable library). */
export type AcmeKvSystem = {
  nextWriteId: number;
  readonly serverStore: Map<string, AcmeKvEntry>;
  readonly clientCaches: Map<string, Map<string, AcmeKvEntry>>;
  /** Client endpoint ids in boot order — used for replicate fanout. */
  readonly clientEndpoints: string[];
  network: SimNetwork | null;
};

export function createAcmeKvSystem(): AcmeKvSystem {
  return {
    nextWriteId: 0,
    serverStore: new Map(),
    clientCaches: new Map(),
    clientEndpoints: [],
    network: null,
  };
}

export function serverEndpointId(): string {
  return 'acme-kv:server';
}

export function clientEndpointId(clientId: string): string {
  return `acme-kv:client:${clientId}`;
}

export function applyLww(
  store: Map<string, AcmeKvEntry>,
  key: string,
  value: string,
  writeId: number
): boolean {
  const prev = store.get(key);
  if (prev !== undefined && prev.writeId >= writeId) return false;
  store.set(key, { value, writeId });
  return true;
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
