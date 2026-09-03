import type { Session } from '../../host/types';
import { isPlainObject } from '../../kernel/json';
import type { Network } from '../../models/network';
import type { AcmeKvEntry } from './types';

export type AcmeKvServerHandle = {
  readonly id: string;
  readonly endpointId: string;
  readonly store: Map<string, AcmeKvEntry>;
  readonly clientEndpoints: string[];
  nextWriteId: number;
  readonly network: Network;
  registerClient(ep: string): void;
};

export type AcmeKvClientHandle = {
  readonly id: string;
  readonly endpointId: string;
  readonly cache: Map<string, AcmeKvEntry>;
  readonly network: Network;
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
  entry: {
    readonly key: string;
    readonly value: string;
    readonly writeId: number;
  }
): boolean {
  const prev = store.get(entry.key);
  if (prev !== undefined && prev.writeId >= entry.writeId) return false;
  store.set(entry.key, { value: entry.value, writeId: entry.writeId });
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
  if (
    !applyLww(handle.store, {
      key: put.key,
      value: put.value,
      writeId: put.writeId,
    })
  ) {
    return;
  }
  fanoutReplicate(handle, put.key, put.value, put.writeId);
}

function onClientDeliver(handle: AcmeKvClientHandle, payload: unknown): void {
  const rep = asReplicate(payload);
  if (rep === null) return;
  applyLww(handle.cache, {
    key: rep.key,
    value: rep.value,
    writeId: rep.writeId,
  });
}

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

export function startServer(session: Session): AcmeKvServerHandle {
  const endpointId = session.ports.network.id;
  const handle: AcmeKvServerHandle = {
    id: endpointId,
    endpointId,
    store: new Map(),
    clientEndpoints: [],
    nextWriteId: 0,
    network: session.network,
    registerClient(ep) {
      this.clientEndpoints.push(ep);
    },
  };
  session.ports.network.listen((payload) => onServerDeliver(handle, payload));
  return handle;
}

export function startClient(
  session: Session,
  server: AcmeKvServerHandle
): AcmeKvClientHandle {
  const endpointId = session.ports.network.id;
  const handle: AcmeKvClientHandle = {
    id: endpointId,
    endpointId,
    cache: new Map(),
    network: session.network,
  };
  session.ports.network.listen((payload) => onClientDeliver(handle, payload));
  server.registerClient(endpointId);
  return handle;
}
