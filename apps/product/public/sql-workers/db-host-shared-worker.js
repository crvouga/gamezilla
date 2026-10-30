// ../../pkgs/sql-client-sqlite-web-shared/src/rpc.ts
var RPC_ERROR_LEADER_LOST = 'E_LEADER_LOST';
var HEARTBEAT_REAP_MS = 15e3;
var OWNER_CLOSE_GRACE_MS = 5e3;
function serializeError(error) {
  if (error instanceof Error) {
    const withCode = error;
    return {
      name: error.name || 'Error',
      message: error.message,
      ...(error.stack !== void 0 ? { stack: error.stack } : {}),
      ...(typeof withCode.code === 'string' ? { code: withCode.code } : {}),
    };
  }
  return {
    name: 'Error',
    message: String(error),
  };
}
function leaderLostError(message = 'Database owner lost') {
  const error = new Error(message);
  error.name = 'LeaderLostError';
  error.code = RPC_ERROR_LEADER_LOST;
  return error;
}

// ../../pkgs/sql-client-sqlite-web-shared/src/broker-core.ts
var FORCE_RELEASE_OWNER_WAIT_MS = 4e3;
function isRpcRequest(message) {
  if (typeof message !== 'object' || message === null) return false;
  const m = message;
  return (
    typeof m['id'] === 'string' &&
    typeof m['dbName'] === 'string' &&
    typeof m['op'] === 'string'
  );
}
function isDbChanged(message) {
  if (typeof message !== 'object' || message === null) return false;
  const m = message;
  return m['type'] === 'db-changed' && typeof m['dbName'] === 'string';
}
function post(state, portId, message) {
  state.ports.get(portId)?.postMessage(message);
}
function getOrCreateSlot(state, dbName) {
  const existing = state.slots.get(dbName);
  if (existing !== void 0) return existing;
  const slot = {
    ownerPortId: null,
    refCount: 0,
    portIds: /* @__PURE__ */ new Set(),
    closeTimerId: null,
  };
  state.slots.set(dbName, slot);
  return slot;
}
function scheduleClose(state, dbName, slot) {
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
function promoteOwner(state, dbName, slot) {
  const next = [...slot.portIds].find((id) => id !== slot.ownerPortId);
  slot.ownerPortId = next ?? null;
  if (next === void 0) return;
  post(state, next, {
    id: `become_${dbName}`,
    dbName,
    op: 'becomeOwner',
    payload: {},
  });
}
function releasePortFromDb(state, portId, dbName) {
  const slot = state.slots.get(dbName);
  if (slot === void 0 || !slot.portIds.has(portId)) return;
  const wasOwner = slot.ownerPortId === portId;
  slot.portIds.delete(portId);
  slot.refCount = Math.max(0, slot.refCount - 1);
  if (wasOwner) {
    promoteOwner(state, dbName, slot);
    rejectPendingRoutes(state, {
      deadPortId: portId,
      reason: 'Database owner disconnected',
    });
  }
  if (slot.refCount === 0) scheduleClose(state, dbName, slot);
}
async function handleConnect(state, portId, request) {
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
    let role = 'proxy';
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
function routeToOwner(state, fromPortId, request) {
  const slot = state.slots.get(request.dbName);
  const ownerId = slot?.ownerPortId ?? null;
  if (ownerId === null || slot === void 0) {
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
function fanoutDbChanged(state, fromPortId, message) {
  const slot = state.slots.get(message.dbName);
  if (slot === void 0) return;
  for (const id of slot.portIds) {
    if (id === fromPortId) continue;
    post(state, id, message);
  }
}
function isRpcResponse(message) {
  return (
    typeof message === 'object' &&
    message !== null &&
    'ok' in message &&
    typeof message.id === 'string'
  );
}
function routeOwnerResponse(state, portId, response) {
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
  if (route === void 0 || route.ownerPortId !== portId) return;
  state.pendingRoutes.delete(response.id);
  post(state, route.fromPortId, response);
}
function isForceReleaseAllMessage(message) {
  return (
    typeof message === 'object' &&
    message !== null &&
    message.type === 'force-release-all'
  );
}
function finishForceRelease(state) {
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
function beginForceRelease(state, requesterPortId, responseId) {
  if (state.forceReleaseWait !== null) {
    finishForceRelease(state);
  }
  const owners = [];
  for (const [dbName, slot] of state.slots) {
    if (slot.closeTimerId !== null) {
      state.timers.clearTimeout(slot.closeTimerId);
      slot.closeTimerId = null;
    }
    if (slot.ownerPortId !== null) {
      owners.push({ portId: slot.ownerPortId, dbName });
    }
  }
  rejectPendingRoutes(state, {
    rejectAll: true,
    reason: 'Database ownership force-released',
  });
  if (owners.length === 0) {
    state.forceReleaseWait = {
      requesterPortId,
      responseId,
      pendingOwnerIds: /* @__PURE__ */ new Set(),
      releaseIds: /* @__PURE__ */ new Set(),
      timerId: null,
    };
    finishForceRelease(state);
    return;
  }
  const pendingOwnerIds = new Set(owners.map((o) => o.portId));
  const releaseIds = new Set(owners.map((o) => `release_${o.dbName}`));
  const wait = {
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
function handleForceReleaseAll(state, portId, message) {
  beginForceRelease(
    state,
    portId,
    typeof message.id === 'string' ? message.id : 'force-release-all'
  );
}
function handleRpcRequest(state, portId, message) {
  if (message.op === 'heartbeat') {
    post(state, portId, { id: message.id, ok: true, result: null });
    return;
  }
  if (message.op === 'connect') {
    void handleConnect(state, portId, message);
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
function handleBrokerMessage(state, portId, message) {
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
function rejectPendingRoutes(state, opts) {
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
function detachPort(state, portId) {
  for (const dbName of [...state.slots.keys()]) {
    releasePortFromDb(state, portId, dbName);
  }
  rejectPendingRoutes(state, {
    deadPortId: portId,
    reason: 'Database owner disconnected',
  });
  state.ports.delete(portId);
  state.lastSeen.delete(portId);
}
function createBrokerCore(timers) {
  const state = {
    ports: /* @__PURE__ */ new Map(),
    lastSeen: /* @__PURE__ */ new Map(),
    slots: /* @__PURE__ */ new Map(),
    connectChains: /* @__PURE__ */ new Map(),
    pendingRoutes: /* @__PURE__ */ new Map(),
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

// ../../pkgs/sql-client-sqlite-web-client/src/db-host-shared-worker.ts
var nextPortId = 0;
var broker = createBrokerCore({
  setTimeout: (fn, ms) => self.setTimeout(fn, ms),
  clearTimeout: (id) => self.clearTimeout(id),
  now: () => Date.now(),
});
self.setInterval(() => {
  broker.tickHeartbeatReaper();
}, 5e3);
self.onconnect = (event) => {
  const port = event.ports[0];
  if (port === void 0) return;
  const id = `port_${++nextPortId}`;
  const brokerPort = {
    id,
    postMessage: (message) => {
      port.postMessage(message);
    },
    close: () => {
      port.close();
    },
  };
  broker.attachPort(brokerPort);
  port.start();
  port.onmessage = (msgEvent) => {
    broker.handleMessage(id, msgEvent.data);
  };
  port.onmessageerror = () => {
    broker.detachPort(id);
  };
  port.addEventListener('close', () => {
    broker.detachPort(id);
  });
};
