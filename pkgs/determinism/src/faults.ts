import type { SimNodeId } from './network';
import type { SimTrace } from './trace';

export type FaultDef = {
  readonly id: string;
  readonly description?: string;
  readonly mode?: 'queue' | 'set';
};

export function defineFault(def: FaultDef): FaultDef {
  return def;
}

export type FaultArmOptions = {
  readonly dedupeKey?: string;
};

type QueueEntry = { readonly payload: unknown };

type SetEntry = {
  readonly dedupeKey: string;
  payload: unknown;
};

export type FaultCatalog = {
  readonly arm: (
    id: string,
    target: SimNodeId,
    payload?: unknown,
    opts?: FaultArmOptions
  ) => void;
  readonly take: (
    id: string,
    target: SimNodeId,
    match?: (payload: unknown) => boolean
  ) => unknown | undefined;
  readonly peek: (
    id: string,
    target: SimNodeId,
    match?: (payload: unknown) => boolean
  ) => unknown | undefined;
  readonly clear: (target?: SimNodeId) => void;
  readonly list: () => readonly FaultDef[];
};

type FaultStore = {
  readonly byId: Map<string, FaultDef>;
  readonly queues: Map<string, QueueEntry[]>;
  readonly sets: Map<string, SetEntry[]>;
  readonly trace: SimTrace | undefined;
};

function slotKey(id: string, target: SimNodeId): string {
  return `${id}\0${target}`;
}

function resolveDedupeKey(payload: unknown, opts?: FaultArmOptions): string {
  if (opts?.dedupeKey !== undefined) return opts.dedupeKey;
  if (
    typeof payload === 'string' ||
    typeof payload === 'number' ||
    typeof payload === 'boolean'
  ) {
    return String(payload);
  }
  throw new Error(
    'FaultCatalog: set mode requires dedupeKey or primitive payload'
  );
}

function requireDef(store: FaultStore, id: string): FaultDef {
  const def = store.byId.get(id);
  if (def === undefined) {
    throw new Error(`FaultCatalog: unknown fault id ${id}`);
  }
  return def;
}

function findIndex(
  entries: readonly { readonly payload: unknown }[],
  match?: (payload: unknown) => boolean
): number {
  if (match === undefined) return entries.length > 0 ? 0 : -1;
  return entries.findIndex((e) => match(e.payload));
}

function armQueue(
  store: FaultStore,
  id: string,
  target: SimNodeId,
  payload: unknown
): void {
  const key = slotKey(id, target);
  const q = store.queues.get(key) ?? [];
  q.push({ payload });
  store.queues.set(key, q);
  store.trace?.record({ type: 'fault', op: 'arm', id, target });
}

function armSet(args: {
  readonly store: FaultStore;
  readonly id: string;
  readonly target: SimNodeId;
  readonly payload: unknown;
  readonly armOpts?: FaultArmOptions;
}): void {
  const { store, id, target, payload, armOpts } = args;
  const key = slotKey(id, target);
  const dedupeKey = resolveDedupeKey(payload, armOpts);
  const list = store.sets.get(key) ?? [];
  const existing = list.find((e) => e.dedupeKey === dedupeKey);
  if (existing !== undefined) existing.payload = payload;
  else {
    list.push({ dedupeKey, payload });
    store.sets.set(key, list);
  }
  store.trace?.record({ type: 'fault', op: 'arm', id, target, dedupeKey });
}

function takeFromList<T extends { readonly payload: unknown }>(
  list: T[] | undefined,
  key: string,
  map: Map<string, T[]>,
  match?: (payload: unknown) => boolean
): T | undefined {
  if (list === undefined || list.length === 0) return undefined;
  const idx = findIndex(list, match);
  if (idx < 0) return undefined;
  const [entry] = list.splice(idx, 1);
  if (list.length === 0) map.delete(key);
  return entry;
}

function takeFault(
  store: FaultStore,
  id: string,
  target: SimNodeId,
  match?: (payload: unknown) => boolean
): unknown | undefined {
  const def = requireDef(store, id);
  const mode = def.mode ?? 'queue';
  const key = slotKey(id, target);
  if (mode === 'queue') {
    const entry = takeFromList(store.queues.get(key), key, store.queues, match);
    if (entry === undefined) return undefined;
    store.trace?.record({ type: 'fault', op: 'take', id, target });
    return entry.payload;
  }
  const entry = takeFromList(store.sets.get(key), key, store.sets, match);
  if (entry === undefined) return undefined;
  store.trace?.record({
    type: 'fault',
    op: 'take',
    id,
    target,
    dedupeKey: entry.dedupeKey,
  });
  return entry.payload;
}

function peekFault(
  store: FaultStore,
  id: string,
  target: SimNodeId,
  match?: (payload: unknown) => boolean
): unknown | undefined {
  const def = requireDef(store, id);
  const mode = def.mode ?? 'queue';
  const key = slotKey(id, target);
  const entries =
    mode === 'queue'
      ? (store.queues.get(key) ?? [])
      : (store.sets.get(key) ?? []);
  const idx = findIndex(entries, match);
  if (idx < 0) return undefined;
  return entries[idx]?.payload;
}

function clearFaults(store: FaultStore, target?: SimNodeId): void {
  if (target === undefined) {
    store.queues.clear();
    store.sets.clear();
    return;
  }
  for (const key of [...store.queues.keys()]) {
    if (key.endsWith(`\0${target}`)) store.queues.delete(key);
  }
  for (const key of [...store.sets.keys()]) {
    if (key.endsWith(`\0${target}`)) store.sets.delete(key);
  }
}

export type CreateFaultCatalogOpts = {
  readonly trace?: SimTrace;
};

export function createFaultCatalog(
  defs: readonly FaultDef[],
  opts?: CreateFaultCatalogOpts
): FaultCatalog {
  const byId = new Map<string, FaultDef>();
  for (const def of defs) {
    if (byId.has(def.id)) {
      throw new Error(`FaultCatalog: duplicate fault id ${def.id}`);
    }
    byId.set(def.id, def);
  }
  const store: FaultStore = {
    byId,
    queues: new Map(),
    sets: new Map(),
    trace: opts?.trace,
  };
  return {
    arm(id, target, payload, armOpts) {
      const def = requireDef(store, id);
      if ((def.mode ?? 'queue') === 'queue') {
        armQueue(store, id, target, payload);
        return;
      }
      armSet({
        store,
        id,
        target,
        payload,
        ...(armOpts !== undefined ? { armOpts } : {}),
      });
    },
    take: (id, target, match) => takeFault(store, id, target, match),
    peek: (id, target, match) => peekFault(store, id, target, match),
    clear: (target) => clearFaults(store, target),
    list: () => [...byId.values()],
  };
}
