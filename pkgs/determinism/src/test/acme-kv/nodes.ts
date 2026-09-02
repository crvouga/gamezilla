import { isPlainObject } from '../../json';
import type { SimNetwork } from '../../network';
import { node } from '../../node';
import type { AcmeKvEntry } from './types';
import { clientEndpointId, serverEndpointId } from './types';

export type AcmeKvServerHandle = {
  readonly id: string;
  readonly endpointId: string;
  readonly store: Map<string, AcmeKvEntry>;
  readonly clientEndpoints: string[];
  nextWriteId: number;
  readonly network: SimNetwork;
  registerClient(ep: string): void;
};

export type AcmeKvClientHandle = {
  readonly id: string;
  readonly endpointId: string;
  readonly cache: Map<string, AcmeKvEntry>;
  readonly network: SimNetwork;
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

function applyLww(
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

function fanoutReplicate(
  handle: AcmeKvServerHandle,
  key: string,
  value: string,
  writeId: number
): void {
  const msg: ReplicateMsg = { type: 'replicate', key, value, writeId };
  for (const to of handle.clientEndpoints) {
    handle.network.send(handle.endpointId, to, msg);
  }
}

function onServerDeliver(handle: AcmeKvServerHandle, payload: unknown): void {
  const put = asPut(payload);
  if (put === null) return;
  const applied = applyLww(handle.store, put.key, put.value, put.writeId);
  if (!applied) return;
  fanoutReplicate(handle, put.key, put.value, put.writeId);
}

function onClientDeliver(handle: AcmeKvClientHandle, payload: unknown): void {
  const rep = asReplicate(payload);
  if (rep === null) return;
  applyLww(handle.cache, rep.key, rep.value, rep.writeId);
}

/** Re-send every server entry to every client (catch-up after partition). */
export function rebroadcastStore(server: AcmeKvServerHandle): void {
  for (const [key, entry] of server.store) {
    fanoutReplicate(server, key, entry.value, entry.writeId);
  }
}

export function sendPut(args: {
  readonly server: AcmeKvServerHandle;
  readonly client: AcmeKvClientHandle;
  readonly key: string;
  readonly value: string;
}): void {
  args.server.nextWriteId += 1;
  const writeId = args.server.nextWriteId;
  const msg: PutMsg = {
    type: 'put',
    clientId: args.client.id,
    key: args.key,
    value: args.value,
    writeId,
  };
  args.client.network.send(args.client.endpointId, args.server.endpointId, msg);
}

export const acmeKvServerNode = node({
  boot: (ctx) => {
    const handle: AcmeKvServerHandle = {
      id: ctx.id,
      endpointId: serverEndpointId(),
      store: new Map(),
      clientEndpoints: [],
      nextWriteId: 0,
      network: ctx.network,
      registerClient(ep) {
        this.clientEndpoints.push(ep);
      },
    };
    ctx.listen(
      (payload) => onServerDeliver(handle, payload),
      handle.endpointId
    );
    return handle;
  },
});

export const acmeKvClientNode = node({
  boot: (ctx) => {
    const server = ctx.peers.single('server') as AcmeKvServerHandle;
    const endpointId = clientEndpointId(ctx.id);
    const cache = new Map<string, AcmeKvEntry>();
    const handle: AcmeKvClientHandle = {
      id: ctx.id,
      endpointId,
      cache,
      network: ctx.network,
    };
    ctx.listen((payload) => onClientDeliver(handle, payload), endpointId);
    server.registerClient(endpointId);
    return handle;
  },
});
