import type { SimFaultOptions } from '../../sim/faults';
import type { SimWorld } from '../../sim/world';
import {
  EMPTY_EDGE,
  type LabAction,
  type LabClientId,
  type LabEdgeState,
  RELIABLE_FAULTS,
} from './types';

export type EdgeMap = Record<LabClientId, LabEdgeState>;
export type SkewMap = Record<LabClientId, number>;
export type LifeState = {
  online: boolean;
  foreground: boolean;
  connected: boolean;
};
export type LifeMap = Record<LabClientId, LifeState>;

export type SessionMutable = {
  world: SimWorld | null;
  rowImageFanout: boolean;
  liveResendOnReconnect: boolean;
  edges: EdgeMap;
  skew: SkewMap;
  life: LifeMap;
  actions: LabAction[];
  lastError: string | null;
  converged: boolean | null;
};

export function freshEdges(): EdgeMap {
  return { alice: { ...EMPTY_EDGE }, bob: { ...EMPTY_EDGE } };
}

export function freshLife(): LifeMap {
  return {
    alice: { online: true, foreground: true, connected: true },
    bob: { online: true, foreground: true, connected: true },
  };
}

export function createSessionMutable(): SessionMutable {
  return {
    world: null,
    rowImageFanout: true,
    liveResendOnReconnect: false,
    edges: freshEdges(),
    skew: { alice: 0, bob: 0 },
    life: freshLife(),
    actions: [],
    lastError: null,
    converged: null,
  };
}

export function pushAction(
  state: SessionMutable,
  label: string,
  ok: boolean,
  error?: string
): void {
  state.actions = [
    ...state.actions.slice(-79),
    {
      at: state.world?.clock.now() ?? Date.now(),
      label,
      ok,
      ...(error !== undefined ? { error } : {}),
    },
  ];
}

export function clientOrThrow(state: SessionMutable, id: LabClientId) {
  if (state.world === null) throw new Error('World is not open');
  const c = state.world.clients.get(id);
  if (c === undefined) throw new Error(`Client ${id} missing`);
  return c;
}

export function applyEdgePartition(
  state: SessionMutable,
  clientId: LabClientId,
  traffic: 'live' | 'sync' | 'all'
): void {
  const prev = state.edges[clientId] ?? EMPTY_EDGE;
  state.edges = {
    ...state.edges,
    [clientId]: {
      ...prev,
      livePartitioned:
        traffic === 'live' || traffic === 'all' ? true : prev.livePartitioned,
      syncPartitioned:
        traffic === 'sync' || traffic === 'all' ? true : prev.syncPartitioned,
    },
  };
  state.world?.partition(clientId, traffic);
}

export function applyUnpartition(
  state: SessionMutable,
  clientId: LabClientId,
  traffic: 'live' | 'sync' | 'all'
): void {
  const prev = state.edges[clientId] ?? EMPTY_EDGE;
  const next: LabEdgeState = {
    ...prev,
    livePartitioned:
      traffic === 'live' || traffic === 'all' ? false : prev.livePartitioned,
    syncPartitioned:
      traffic === 'sync' || traffic === 'all' ? false : prev.syncPartitioned,
  };
  state.edges = { ...state.edges, [clientId]: next };
  state.world?.heal(clientId);
  if (next.livePartitioned) state.world?.partition(clientId, 'live');
  if (next.syncPartitioned) state.world?.partition(clientId, 'sync');
}

export function applyHold(
  state: SessionMutable,
  clientId: LabClientId,
  traffic: 'live' | 'sync' | 'all',
  held: boolean
): void {
  const prev = state.edges[clientId] ?? EMPTY_EDGE;
  const live = traffic === 'live' || traffic === 'all' ? held : prev.liveHeld;
  const sync = traffic === 'sync' || traffic === 'all' ? held : prev.syncHeld;
  state.edges = {
    ...state.edges,
    [clientId]: { ...prev, liveHeld: live, syncHeld: sync },
  };
  const w = state.world;
  if (w === null) return;
  if (held) {
    if (traffic === 'live' || traffic === 'all') w.hold(clientId, 'live');
    if (traffic === 'sync' || traffic === 'all') w.hold(clientId, 'sync');
    return;
  }
  if (traffic === 'live' || traffic === 'all') w.release(clientId, 'live');
  if (traffic === 'sync' || traffic === 'all') w.release(clientId, 'sync');
}

export function applyFaults(
  state: SessionMutable,
  clientId: LabClientId,
  traffic: 'live' | 'sync' | 'all',
  faults: Partial<SimFaultOptions>
): void {
  const prev = state.edges[clientId] ?? EMPTY_EDGE;
  state.edges = {
    ...state.edges,
    [clientId]: { ...prev, faults: { ...prev.faults, ...faults } },
  };
  state.world?.setFaults(clientId, traffic, faults);
}

export function clearFaultsState(
  state: SessionMutable,
  clientId: LabClientId
): void {
  const prev = state.edges[clientId] ?? EMPTY_EDGE;
  state.edges = {
    ...state.edges,
    [clientId]: { ...prev, faults: RELIABLE_FAULTS },
  };
  state.world?.clearFaults(clientId);
}
