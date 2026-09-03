import type { Session } from '../../host/types';
import { isPlainObject } from '../../kernel/json';
import type { Network } from '../../models/network';
import type { Note } from './types';

export type SyncServerHandle = {
  readonly id: string;
  readonly endpointId: string;
  readonly notes: Map<string, Note>;
  readonly clientEndpoints: string[];
  readonly network: Network;
  registerClient(ep: string): void;
};

export type SyncClientHandle = {
  readonly id: string;
  readonly endpointId: string;
  readonly notes: Map<string, Note>;
  /** Local writes not yet acked by the server (stands in for pending mutations). */
  readonly pending: Note[];
  readonly network: Network;
};

type UploadMsg = {
  readonly type: 'upload';
  readonly note: Note;
  readonly from: string;
};

type AckMsg = {
  readonly type: 'ack';
  readonly id: string;
};

type ReplicateMsg = {
  readonly type: 'replicate';
  readonly note: Note;
};

function asUpload(payload: unknown): UploadMsg | null {
  if (!isPlainObject(payload) || payload['type'] !== 'upload') return null;
  const from = payload['from'];
  const note = payload['note'];
  if (typeof from !== 'string' || !isPlainObject(note)) return null;
  const id = note['id'];
  const body = note['body'];
  if (typeof id !== 'string' || typeof body !== 'string') return null;
  return { type: 'upload', from, note: { id, body } };
}

function asAck(payload: unknown): AckMsg | null {
  if (!isPlainObject(payload) || payload['type'] !== 'ack') return null;
  const id = payload['id'];
  if (typeof id !== 'string') return null;
  return { type: 'ack', id };
}

function asReplicate(payload: unknown): ReplicateMsg | null {
  if (!isPlainObject(payload) || payload['type'] !== 'replicate') return null;
  const note = payload['note'];
  if (!isPlainObject(note)) return null;
  const id = note['id'];
  const body = note['body'];
  if (typeof id !== 'string' || typeof body !== 'string') return null;
  return { type: 'replicate', note: { id, body } };
}

function fanout(server: SyncServerHandle, note: Note, except?: string): void {
  const msg: ReplicateMsg = { type: 'replicate', note };
  for (const to of server.clientEndpoints) {
    if (to === except) continue;
    server.network.send(server.endpointId, to, msg);
  }
}

function onServerDeliver(server: SyncServerHandle, payload: unknown): void {
  const up = asUpload(payload);
  if (up === null) return;
  server.notes.set(up.note.id, up.note);
  const ack: AckMsg = { type: 'ack', id: up.note.id };
  server.network.send(server.endpointId, up.from, ack);
  fanout(server, up.note, up.from);
}

function onClientDeliver(client: SyncClientHandle, payload: unknown): void {
  const ack = asAck(payload);
  if (ack !== null) {
    const i = client.pending.findIndex((n) => n.id === ack.id);
    if (i >= 0) client.pending.splice(i, 1);
    return;
  }
  const rep = asReplicate(payload);
  if (rep === null) return;
  client.notes.set(rep.note.id, rep.note);
}

export function flushPending(
  server: SyncServerHandle,
  client: SyncClientHandle
): void {
  for (const note of client.pending) {
    const msg: UploadMsg = {
      type: 'upload',
      note,
      from: client.endpointId,
    };
    client.network.send(client.endpointId, server.endpointId, msg);
  }
}

/** After heal — push server notes to every client (stands in for sync catch-up). */
export function rebroadcastNotes(server: SyncServerHandle): void {
  for (const note of server.notes.values()) {
    fanout(server, note);
  }
}

export function createNoteOnClient(args: {
  readonly server: SyncServerHandle;
  readonly client: SyncClientHandle;
  readonly id: string;
  readonly body: string;
}): void {
  const note: Note = { id: args.id, body: args.body };
  args.client.notes.set(note.id, note);
  args.client.pending.push(note);
  const msg: UploadMsg = {
    type: 'upload',
    note,
    from: args.client.endpointId,
  };
  args.client.network.send(args.client.endpointId, args.server.endpointId, msg);
}

export function startServer(session: Session): SyncServerHandle {
  const endpointId = session.ports.network.id;
  const handle: SyncServerHandle = {
    id: endpointId,
    endpointId,
    notes: new Map(),
    clientEndpoints: [],
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
  server: SyncServerHandle
): SyncClientHandle {
  const endpointId = session.ports.network.id;
  const handle: SyncClientHandle = {
    id: endpointId,
    endpointId,
    notes: new Map(),
    pending: [],
    network: session.network,
  };
  session.ports.network.listen((payload) => onClientDeliver(handle, payload));
  server.registerClient(endpointId);
  return handle;
}
