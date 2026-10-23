import type {
  BrokerToTabMessage,
  DbChangedNotify,
  RpcRequest,
  RpcResponse,
} from './rpc';
import {
  HEARTBEAT_REAP_MS,
  leaderLostError,
  OWNER_CLOSE_GRACE_MS,
  serializeError,
} from './rpc';

export type BrokerPort = {
  readonly id: string;
  postMessage: (message: BrokerToTabMessage) => void;
  close?: () => void;
};

export type DbSlot = {
  ownerPortId: string | null;
  refCount: number;
  readonly portIds: Set<string>;
  closeTimerId: unknown | null;
};

export type BrokerTimers = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
  now: () => number;
};

export type BrokerCore = {
  attachPort: (port: BrokerPort) => void;
  detachPort: (portId: string) => void;
  handleMessage: (portId: string, message: unknown) => void;
  tickHeartbeatReaper: () => void;
  getSlot: (dbName: string) => DbSlot | undefined;
  getPortLastSeen: (portId: string) => number | undefined;
  /** Ask every owner to drop OPFS, then clear broker slots (web OPFS wipe). */
  forceReleaseAll: () => void;
};

/** Wait for owners to finish closeAsync before acknowledging force-release. */
const FORCE_RELEASE_OWNER_WAIT_MS = 4_000;

type ForceReleaseWait = {
  readonly requesterPortId: string | null;
  readonly responseId: string | null;
  readonly pendingOwnerIds: Set<string>;
  readonly releaseIds: Set<string>;
  timerId: unknown | null;
};

type BrokerState = {
  readonly ports: Map<string, BrokerPort>;
  readonly lastSeen: Map<string, number>;
  readonly slots: Map<string, DbSlot>;
  readonly connectChains: Map<string, Promise<DbSlot>>;
  readonly pendingRoutes: Map<
    string,
    { readonly fromPortId: string; readonly ownerPortId: string }
  >;
  forceReleaseWait: ForceReleaseWait | null;
  readonly timers: BrokerTimers;
};

function isRpcRequest(message: unknown): message is RpcRequest {
  if (typeof message !== 'object' || message === null) return false;
  const m = message as Record<string, unknown>;
  return (
    typeof m['id'] === 'string' &&
    typeof m['dbName'] === 'string' &&
    typeof m['op'] === 'string'
  );
}

function isDbChanged(message: unknown): message is DbChangedNotify {
  if (typeof message !== 'object' || message === null) return false;
  const m = message as Record<string, unknown>;
  return m['type'] === 'db-changed' && typeof m['dbName'] === 'string';
}

function post(
  state: BrokerState,
  portId: string,
  message: BrokerToTabMessage
): void {
  state.ports.get(portId)?.postMessage(message);
}

function getOrCreateSlot(state: BrokerState, dbName: string): DbSlot {
  const existing = state.slots.get(dbName);
  if (existing !== undefined) return existing;
  const slot: DbSlot = {
    ownerPortId: null,
    refCount: 0,
    portIds: new Set(),
    closeTimerId: null,
  };
  state.slots.set(dbName, slot);
  return slot;
}

function scheduleClose(state: BrokerState, dbName: string, slot: DbSlot): void {
  if (slot.closeTimerId !== null) {
    state.timers.clearTimeout(slot.closeTimerId);
  }
  slot.closeTimerId = state.timers.setTimeout(() => {
    if (slot.refCount > 0) return;
    const ownerId = slot.ownerPortId;
    if (ownerId !== null) {
      post(state, ownerId, {
        id: `release_${dbName}`,
        dbName,
        op: 'releaseOwner',
        payload: {},
      });
    }
    state.slots.delete(dbName);
    state.connectChains.delete(dbName);
  }, OWNER_CLOSE_GRACE_MS);
}

function promoteOwner(state: BrokerState, dbName: string, slot: DbSlot): void {
  const next = [...slot.portIds].find((id) => id !== slot.ownerPortId);
  slot.ownerPortId = next ?? null;
  if (next === undefined) return;
  // Single becomeOwner path (double-open via assign-role was removed).
  post(state, next, {
    id: `become_${dbName}`,
    dbName,
    op: 'becomeOwner',
    payload: {},
  });
}

function releasePortFromDb(
  state: BrokerState,
  portId: string,
  dbName: string
): void {
  const slot = state.slots.get(dbName);
  if (slot === undefined || !slot.portIds.has(portId)) return;
  const wasOwner = slot.ownerPortId === portId;
  slot.portIds.delete(portId);
  slot.refCount = Math.max(0, slot.refCount - 1);
  if (wasOwner) {
    promoteOwner(state, dbName, slot);
    // In-flight proxy RPCs targeted the old owner — fail them now.
    rejectPendingRoutes(state, {
      deadPortId: portId,
      reason: 'Database owner disconnected',
    });
  }
  if (slot.refCount === 0) scheduleClose(state, dbName, slot);
}

async function handleConnect(
  state: BrokerState,
  portId: string,
  request: RpcRequest<'connect'>
): Promise<void> {
  const chain =
    state.connectChains.get(request.dbName) ??
    Promise.resolve(getOrCreateSlot(state, request.dbName));
  const next = chain.then((slot) => {
    if (slot.closeTimerId !== null) {
      state.timers.clearTimeout(slot.closeTimerId);
      slot.closeTimerId = null;
    }
    slot.portIds.add(portId);
    slot.refCount += 1;
    let role: 'owner' | 'proxy' = 'proxy';
    if (slot.ownerPortId === null) {
      slot.ownerPortId = portId;
      role = 'owner';
    }
    post(state, portId, {
      id: request.id,
      ok: true,
      result: { role },
    });
    return slot;
  });
  state.connectChains.set(request.dbName, next);
  await next;
}

function routeToOwner(
  state: BrokerState,
  fromPortId: string,
  request: RpcRequest
): void {
  const slot = state.slots.get(request.dbName);
  const ownerId = slot?.ownerPortId ?? null;
  if (ownerId === null || slot === undefined) {
    post(state, fromPortId, {
      id: request.id,
      ok: false,
      error: serializeError(leaderLostError('No database owner')),
    });
    return;
  }
  if (ownerId === fromPortId) {
    post(state, fromPortId, {
      id: request.id,
      ok: false,
      error: serializeError(
        new Error('Owner should execute SQL locally, not via broker')
      ),
    });
    return;
  }
  post(state, ownerId, { ...request, from: fromPortId });
}

function fanoutDbChanged(
  state: BrokerState,
  fromPortId: string,
  message: DbChangedNotify
): void {
  const slot = state.slots.get(message.dbName);
  if (slot === undefined) return;
  for (const id of slot.portIds) {
    if (id === fromPortId) continue;
    post(state, id, message);
  }
}

function isRpcResponse(message: unknown): message is RpcResponse {
  return (
    typeof message === 'object' &&
    message !== null &&
    'ok' in message &&
    typeof (message as RpcResponse).id === 'string'
  );
}

function routeOwnerResponse(
  state: BrokerState,
  portId: string,
  response: RpcResponse
): void {
  const wait = state.forceReleaseWait;
  if (
    wait !== null &&
    wait.releaseIds.has(response.id) &&
    wait.pendingOwnerIds.has(portId)
  ) {
    wait.pendingOwnerIds.delete(portId);
    if (wait.pendingOwnerIds.size === 0) {
      finishForceRelease(state);
    }
    return;
  }
  const route = state.pendingRoutes.get(response.id);
  if (route === undefined || route.ownerPortId !== portId) return;
  state.pendingRoutes.delete(response.id);
  post(state, route.fromPortId, response);
}

function isForceReleaseAllMessage(
  message: unknown
): message is { readonly type: 'force-release-all'; readonly id?: string } {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: string }).type === 'force-release-all'
  );
}

function finishForceRelease(state: BrokerState): void {
  const wait = state.forceReleaseWait;
  if (wait === null) return;
  if (wait.timerId !== null) {
    state.timers.clearTimeout(wait.timerId);
  }
  state.forceReleaseWait = null;
  for (const slot of state.slots.values()) {
    if (slot.closeTimerId !== null) {
      state.timers.clearTimeout(slot.closeTimerId);
      slot.closeTimerId = null;
    }
  }
  state.slots.clear();
  state.connectChains.clear();
  if (wait.requesterPortId !== null && wait.responseId !== null) {
    post(state, wait.requesterPortId, {
      id: wait.responseId,
      ok: true,
      result: null,
    });
  }
}

function beginForceRelease(
  state: BrokerState,
  requesterPortId: string | null,
  responseId: string | null
): void {
  if (state.forceReleaseWait !== null) {
    finishForceRelease(state);
  }

  const owners: { readonly portId: string; readonly dbName: string }[] = [];
  for (const [dbName, slot] of state.slots) {
    if (slot.closeTimerId !== null) {
      state.timers.clearTimeout(slot.closeTimerId);
      slot.closeTimerId = null;
    }
    if (slot.ownerPortId !== null) {
      owners.push({ portId: slot.ownerPortId, dbName });
    }
  }

  // Unblock proxies immediately; OPFS close still in flight on owners.
  rejectPendingRoutes(state, {
    rejectAll: true,
    reason: 'Database ownership force-released',
  });

  if (owners.length === 0) {
    state.forceReleaseWait = {
      requesterPortId,
      responseId,
      pendingOwnerIds: new Set(),
      releaseIds: new Set(),
      timerId: null,
    };
    finishForceRelease(state);
    return;
  }

  const pendingOwnerIds = new Set(owners.map((o) => o.portId));
  const releaseIds = new Set(owners.map((o) => `release_${o.dbName}`));
  const wait: ForceReleaseWait = {
    requesterPortId,
    responseId,
    pendingOwnerIds,
    releaseIds,
    timerId: null,
  };
  state.forceReleaseWait = wait;
  wait.timerId = state.timers.setTimeout(() => {
    finishForceRelease(state);
  }, FORCE_RELEASE_OWNER_WAIT_MS);

  for (const owner of owners) {
    post(state, owner.portId, {
      id: `release_${owner.dbName}`,
      dbName: owner.dbName,
      op: 'releaseOwner',
      payload: {},
    });
  }
}

function handleForceReleaseAll(
  state: BrokerState,
  portId: string,
  message: { readonly id?: string }
): void {
  beginForceRelease(
    state,
    portId,
    typeof message.id === 'string' ? message.id : 'force-release-all'
  );
}

function handleRpcRequest(
  state: BrokerState,
  portId: string,
  message: RpcRequest
): void {
  if (message.op === 'heartbeat') {
    post(state, portId, { id: message.id, ok: true, result: null });
    return;
  }
  if (message.op === 'connect') {
    void handleConnect(state, portId, message as RpcRequest<'connect'>);
    return;
  }
  if (message.op === 'disconnect') {
    releasePortFromDb(state, portId, message.dbName);
    post(state, portId, { id: message.id, ok: true, result: null });
    return;
  }
  const ownerId = state.slots.get(message.dbName)?.ownerPortId ?? null;
  if (ownerId !== null && ownerId !== portId) {
    state.pendingRoutes.set(message.id, {
      fromPortId: portId,
      ownerPortId: ownerId,
    });
  }
  routeToOwner(state, portId, message);
}

function handleBrokerMessage(
  state: BrokerState,
  portId: string,
  message: unknown
): void {
  state.lastSeen.set(portId, state.timers.now());
  if (isDbChanged(message)) {
    fanoutDbChanged(state, portId, message);
    return;
  }
  if (isRpcResponse(message)) {
    routeOwnerResponse(state, portId, message);
    return;
  }
  if (!isRpcRequest(message)) {
    if (isForceReleaseAllMessage(message)) {
      handleForceReleaseAll(state, portId, message);
    }
    return;
  }
  handleRpcRequest(state, portId, message);
}

/**
 * Drop pending proxy→owner routes. When the owner dies (or all ownership is
 * force-released), answer the proxy immediately with E_LEADER_LOST so it does
 * not hang until the RPC timeout.
 */
function rejectPendingRoutes(
  state: BrokerState,
  opts: {
    readonly deadPortId?: string;
    readonly rejectAll?: boolean;
    readonly reason: string;
  }
): void {
  const error = serializeError(leaderLostError(opts.reason));
  for (const [id, route] of [...state.pendingRoutes]) {
    const ownerDead =
      opts.rejectAll === true || route.ownerPortId === opts.deadPortId;
    const fromDead = route.fromPortId === opts.deadPortId;
    if (!ownerDead && !fromDead) continue;
    state.pendingRoutes.delete(id);
    if (ownerDead && !fromDead) {
      post(state, route.fromPortId, {
        id,
        ok: false,
        error,
      });
    }
  }
}

function detachPort(state: BrokerState, portId: string): void {
  for (const dbName of [...state.slots.keys()]) {
    releasePortFromDb(state, portId, dbName);
  }
  // Reject before deleting the port so proxies can still receive the error.
  rejectPendingRoutes(state, {
    deadPortId: portId,
    reason: 'Database owner disconnected',
  });
  state.ports.delete(portId);
  state.lastSeen.delete(portId);
}

/**
 * Pure SharedWorker broker: elects one owner port per dbName, refcounts
 * connects, routes proxy RPC to the owner, and reaps silent ports.
 */
export function createBrokerCore(timers: BrokerTimers): BrokerCore {
  const state: BrokerState = {
    ports: new Map(),
    lastSeen: new Map(),
    slots: new Map(),
    connectChains: new Map(),
    pendingRoutes: new Map(),
    forceReleaseWait: null,
    timers,
  };
  return {
    attachPort: (port) => {
      state.ports.set(port.id, port);
      state.lastSeen.set(port.id, timers.now());
    },
    detachPort: (portId) => detachPort(state, portId),
    handleMessage: (portId, message) =>
      handleBrokerMessage(state, portId, message),
    tickHeartbeatReaper: () => {
      const now = timers.now();
      for (const [portId, seen] of state.lastSeen) {
        if (now - seen < HEARTBEAT_REAP_MS) continue;
        detachPort(state, portId);
      }
    },
    getSlot: (dbName) => state.slots.get(dbName),
    getPortLastSeen: (portId) => state.lastSeen.get(portId),
    forceReleaseAll: () => beginForceRelease(state, null, null),
  };
}
