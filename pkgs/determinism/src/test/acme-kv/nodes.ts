import { isPlainObject } from '../../json';
import type { SimNetwork } from '../../network';
import { defineNodeKind } from '../../node-kind';
import {
  ACME_KV_CLIENT_KIND,
  ACME_KV_SERVER_KIND,
  type AcmeKvEntry,
  type AcmeKvSystem,
  applyLww,
  clientEndpointId,
  serverEndpointId,
} from './types';

export type AcmeKvServerHandle = {
  readonly id: string;
  readonly endpointId: string;
  readonly system: AcmeKvSystem;
  readonly network: SimNetwork;
};

export type AcmeKvClientHandle = {
  readonly id: string;
  readonly endpointId: string;
  readonly system: AcmeKvSystem;
  readonly network: SimNetwork;
  readonly cache: Map<string, AcmeKvEntry>;
};

type PutMsg = {
  readonly type: 'put';
  readonly clientId: string;
  readonly key: string;
  readonly value: string;
  readonly writeId: number;
};

type ReplicateMsg = {
  readonly type: 'replicate';
  readonly key: string;
  readonly value: string;
  readonly writeId: number;
};

function asPut(payload: unknown): PutMsg | null {
  if (!isPlainObject(payload) || payload['type'] !== 'put') return null;
  const key = payload['key'];
  const value = payload['value'];
  const writeId = payload['writeId'];
  const clientId = payload['clientId'];
  if (
    typeof key !== 'string' ||
    typeof value !== 'string' ||
    typeof writeId !== 'number' ||
    typeof clientId !== 'string'
  ) {
    return null;
  }
  return { type: 'put', clientId, key, value, writeId };
}

function asReplicate(payload: unknown): ReplicateMsg | null {
  if (!isPlainObject(payload) || payload['type'] !== 'replicate') return null;
  const key = payload['key'];
  const value = payload['value'];
  const writeId = payload['writeId'];
  if (
    typeof key !== 'string' ||
    typeof value !== 'string' ||
    typeof writeId !== 'number'
  ) {
    return null;
  }
  return { type: 'replicate', key, value, writeId };
}

function fanoutReplicate(
  handle: AcmeKvServerHandle,
  key: string,
  value: string,
  writeId: number
): void {
  const msg: ReplicateMsg = { type: 'replicate', key, value, writeId };
  for (const to of handle.system.clientEndpoints) {
    handle.network.send(handle.endpointId, to, msg);
  }
}

function onServerDeliver(handle: AcmeKvServerHandle, payload: unknown): void {
  const put = asPut(payload);
  if (put === null) return;
  const applied = applyLww(
    handle.system.serverStore,
    put.key,
    put.value,
    put.writeId
  );
  if (!applied) return;
  fanoutReplicate(handle, put.key, put.value, put.writeId);
}

function onClientDeliver(handle: AcmeKvClientHandle, payload: unknown): void {
  const rep = asReplicate(payload);
  if (rep === null) return;
  applyLww(handle.cache, rep.key, rep.value, rep.writeId);
}

/** Re-send every server entry to every client (catch-up after partition). */
export function rebroadcastStore(system: AcmeKvSystem): void {
  const network = system.network;
  if (network === null) return;
  const from = serverEndpointId();
  for (const [key, entry] of system.serverStore) {
    const msg: ReplicateMsg = {
      type: 'replicate',
      key,
      value: entry.value,
      writeId: entry.writeId,
    };
    for (const to of system.clientEndpoints) {
      network.send(from, to, msg);
    }
  }
}

export function sendPut(args: {
  readonly system: AcmeKvSystem;
  readonly clientId: string;
  readonly key: string;
  readonly value: string;
}): void {
  const network = args.system.network;
  if (network === null) {
    throw new Error('acme-kv: network not ready');
  }
  args.system.nextWriteId += 1;
  const writeId = args.system.nextWriteId;
  const msg: PutMsg = {
    type: 'put',
    clientId: args.clientId,
    key: args.key,
    value: args.value,
    writeId,
  };
  network.send(clientEndpointId(args.clientId), serverEndpointId(), msg);
}

export const acmeKvServerNode = defineNodeKind<
  AcmeKvServerHandle,
  AcmeKvServerHandle,
  AcmeKvSystem
>({
  id: ACME_KV_SERVER_KIND,
  boot: (ctx) => {
    ctx.system.network = ctx.network;
    const handle: AcmeKvServerHandle = {
      id: ctx.nodeId,
      endpointId: serverEndpointId(),
      system: ctx.system,
      network: ctx.network,
    };
    return handle;
  },
  endpoints: (handle) => [
    {
      id: handle.endpointId,
      deliver: async (payload) => {
        onServerDeliver(handle, payload);
      },
    },
  ],
  view: (h) => h,
});

export const acmeKvClientNode = defineNodeKind<
  AcmeKvClientHandle,
  AcmeKvClientHandle,
  AcmeKvSystem
>({
  id: ACME_KV_CLIENT_KIND,
  boot: (ctx) => {
    const cache = new Map<string, AcmeKvEntry>();
    ctx.system.clientCaches.set(ctx.nodeId, cache);
    const endpointId = clientEndpointId(ctx.nodeId);
    ctx.system.clientEndpoints.push(endpointId);
    if (ctx.system.network === null) {
      ctx.system.network = ctx.network;
    }
    const handle: AcmeKvClientHandle = {
      id: ctx.nodeId,
      endpointId,
      system: ctx.system,
      network: ctx.network,
      cache,
    };
    return handle;
  },
  endpoints: (handle) => [
    {
      id: handle.endpointId,
      deliver: async (payload) => {
        onClientDeliver(handle, payload);
      },
    },
  ],
  view: (h) => h,
});

/** Re-register after {@link clearNodeKindRegistry} (contract tests). */
export function registerAcmeKvNodeKinds(): void {
  defineNodeKind(acmeKvServerNode);
  defineNodeKind(acmeKvClientNode);
}
