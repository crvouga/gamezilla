/**
 * App-independent explore / walk pool. Every entry reads the booted app from
 * `s.runtime`, so one catalog is passed into every sync `defineSystem` via
 * `SYNC_POOL_ACTIONS`. Pool actions fold in the care a random walk needs
 * (restoreNetwork before restart, remake crashed clients on `connect`, tolerate the
 * faults chaos deliberately races into) — the raw one-call pins live in
 * `regression-actions.ts` / `regression-random-faults-actions.ts`.
 */

import { defineAction } from '@pkgs/harness-root-shared/define-action';
import type {
  Action,
  ArgsSampler,
  CatalogAction,
} from '@pkgs/harness-root-shared/effect';
import { gen } from '@pkgs/harness-root-shared/fast-check';
import fc from 'fast-check';
import {
  AUTH_STATUSES,
  CORRUPTION_VARIANTS,
  HARNESS_PBT_CRASH_EVENTS,
  HOLD_TRAFFIC,
  HTTP_FAULTS,
  MILD_NET_FAULTS,
  pubsubFaults,
  SCHEMA_VARIANTS,
  SKEW_MS_VALUES,
  STORAGE_PRESSURES,
  STORAGE_TAMPERS,
} from './catalog';
import type { HarnessAuthStatus } from './client-factory-parts';
import type { HarnessPubsubFault } from './edge-fault-pubsub';
import type { HarnessCrashEvent, HarnessHttpFault } from './edge-faults';
import type { HarnessSessionQuery } from './harness-domain-pack';
import {
  forgetOwedRestart,
  isExpectedRestartFault,
  isToleratedPoolError,
  oweRestart,
  oweRevokedRestart,
  prepareRestart,
  restartClientForConverge,
  restoreAllNetwork,
  restoreNetworkForIdle,
} from './pool-support';
import type { DomainOp, ServerOp } from './scenario-app';
import type { SyncHarness } from './scenario-system';
import type { LocalStorageTamper } from './storage-faults';
import type { StoragePressureKind } from './storage-pressure';
import { clientIds, partitioned } from './sync-observations';
import type { HarnessTraffic } from './traffic';

type Awaitable<T> = T | Promise<T>;

type PoolDef<A extends unknown[]> = {
  readonly name: string;
  /** Defaults to "at least one client is booted". */
  readonly enabled?: (s: SyncHarness) => boolean;
  readonly weight?: (s: SyncHarness) => number;
  readonly sample: (s: SyncHarness) => ArgsSampler<A>;
  readonly act: (s: SyncHarness, ...args: A) => Awaitable<void>;
};

function hasClients(s: SyncHarness): boolean {
  return clientIds(s).length > 0;
}

/**
 * Pool wrapper: tolerate chaos-vs-constraint races and record any client the
 * step tore down so `connect` / `restart` / `recoverAll` remake it later.
 */
function definePoolAction<const A extends unknown[]>(
  def: PoolDef<A>
): Action<SyncHarness, A> {
  return defineAction<SyncHarness, A>({
    name: def.name,
    enabled: def.enabled ?? hasClients,
    ...(def.weight !== undefined ? { weight: def.weight } : {}),
    sample: def.sample,
    act: async (s, ...args) => {
      const aliveBefore = new Set(s.clients.keys());
      try {
        await def.act(s, ...args);
      } catch (error) {
        if (!isToleratedPoolError(error)) throw error;
      } finally {
        for (const id of aliveBefore) {
          if (!s.clients.has(id)) oweRestart(s, id);
        }
      }
    },
  });
}

const pickClient = (s: SyncHarness) => fc.constantFrom(...clientIds(s));
const pickTraffic = fc.constantFrom(...HOLD_TRAFFIC);
const pickClientAndTraffic = (s: SyncHarness) =>
  gen(fc.tuple(pickClient(s), pickTraffic));
const drawClient = (s: SyncHarness) => gen(pickClient(s));

function nextPeerEngineId(ids: readonly string[]): string {
  let max = -1;
  for (const id of ids) {
    const parsed = Number.parseInt(id.slice(1), 10);
    if (Number.isFinite(parsed) && parsed > max) max = parsed;
  }
  return `c${String(max + 1)}`;
}

function sessionQueryOf(s: SyncHarness): HarnessSessionQuery {
  return s.runtime.sessionQuery ?? s.runtime.app.pack.sessionQuery;
}

// --- connectivity ----------------------------------------------------------

const offline = definePoolAction<[string]>({
  name: 'offline',
  sample: drawClient,
  act: (s, clientId) => s.clients.get(clientId)?.online(false),
});

const online = definePoolAction<[string]>({
  name: 'online',
  sample: drawClient,
  act: (s, clientId) => s.clients.get(clientId)?.online(true),
});

const disconnect = definePoolAction<[string]>({
  name: 'disconnect',
  sample: drawClient,
  act: async (s, clientId) => {
    await s.clients.get(clientId)?.disconnect();
  },
});

/** Reconnect; a client the pool crashed / revoked / cut is remade first. */
const connect = definePoolAction<[string]>({
  name: 'connect',
  sample: drawClient,
  act: async (s, clientId) => {
    if (s.runtime.owed.restart.has(clientId)) {
      s.clearEdgeFaults();
      restoreNetworkForIdle(s);
      await restartClientForConverge(s, clientId, {
        preserveLocalDb: !s.runtime.owed.fresh.has(clientId),
      });
      forgetOwedRestart(s, clientId);
      return;
    }
    await s.clients.get(clientId)?.connect();
  },
});

const background = definePoolAction<[string]>({
  name: 'background',
  sample: drawClient,
  act: (s, clientId) => s.clients.get(clientId)?.foreground(false),
});

const foreground = definePoolAction<[string]>({
  name: 'foreground',
  sample: drawClient,
  act: (s, clientId) => s.clients.get(clientId)?.foreground(true),
});

// --- network ---------------------------------------------------------------

const partition = definePoolAction<[string, HarnessTraffic]>({
  name: 'partition',
  sample: pickClientAndTraffic,
  act: (s, nodeId, traffic) => {
    s.net(nodeId, traffic).set('down');
  },
});

const pauseNetwork = definePoolAction<[string, HarnessTraffic]>({
  name: 'pauseNetwork',
  sample: pickClientAndTraffic,
  act: (s, nodeId, traffic) => {
    s.net(nodeId, traffic).set('hold');
  },
});

const resumeNetwork = definePoolAction<[string, HarnessTraffic]>({
  name: 'resumeNetwork',
  sample: pickClientAndTraffic,
  act: (s, nodeId, traffic) => {
    s.net(nodeId, traffic).set('ok');
  },
});

const setFaults = definePoolAction<[string, HarnessTraffic]>({
  name: 'setFaults',
  sample: pickClientAndTraffic,
  act: (s, nodeId, traffic) => {
    s.net(nodeId, traffic).set(MILD_NET_FAULTS);
  },
});

/** Full fabric restoreNetwork — walks draw it only while links are down, weighted by count. */
const restoreNetwork = definePoolAction<[]>({
  name: 'restoreNetwork',
  weight: (s) => partitioned(s).length,
  sample: () => gen(fc.constant([] as const)),
  act: (s) => restoreAllNetwork(s),
});

const freeze = definePoolAction<[string]>({
  name: 'freeze',
  sample: drawClient,
  act: (s, clientId) => {
    s.net(clientId, 'sync').set('hold');
  },
});

const thaw = definePoolAction<[string]>({
  name: 'thaw',
  sample: drawClient,
  act: (s, clientId) => {
    s.net(clientId, 'sync').set('ok');
    void s.clients.get(clientId)?.nudge();
  },
});

// --- boundary faults -------------------------------------------------------

const armHttpFault = definePoolAction<[string, HarnessHttpFault]>({
  name: 'armHttpFault',
  sample: (s) => gen(fc.tuple(pickClient(s), fc.constantFrom(...HTTP_FAULTS))),
  act: (s, clientId, fault) => {
    s.node(clientId).httpFault(fault);
  },
});

const armCrashAt = definePoolAction<[string, HarnessCrashEvent]>({
  name: 'armCrashAt',
  sample: (s) =>
    gen(fc.tuple(pickClient(s), fc.constantFrom(...HARNESS_PBT_CRASH_EVENTS))),
  act: (s, clientId, event) => {
    s.node(clientId).crash({ at: event });
  },
});

const publishFault = definePoolAction<[number | 'next']>({
  name: 'publishFault',
  sample: () => gen(fc.constantFrom(1, 2, 'next' as const)),
  act: (s, count) => {
    s.node('server').publishFault(count);
  },
});

const armPubsubFault = definePoolAction<[HarnessPubsubFault]>({
  name: 'armPubsubFault',
  sample: (s) =>
    gen(
      fc.oneof(
        fc.constantFrom(...pubsubFaults(s.runtime.app.pack.fuzzDropTopic)),
        fc.constantFrom(...CORRUPTION_VARIANTS).map((variant) => ({
          kind: 'corruptPubsubPayload' as const,
          variant,
        }))
      )
    ),
  act: (s, fault) => {
    s.node('server').pubsubFault(fault);
  },
});

/** Revoked auth tears the session down and owes a fresh-db restart. */
const auth = definePoolAction<[string, HarnessAuthStatus]>({
  name: 'auth',
  sample: (s) =>
    gen(fc.tuple(pickClient(s), fc.constantFrom(...AUTH_STATUSES))),
  act: async (s, clientId, status) => {
    s.node(clientId).auth(status);
    if (status !== 'revoked') return;
    await s.clients.get(clientId)?.disconnect();
    oweRevokedRestart(s, clientId);
  },
});

/** Pending mutations survive the cut; settle remakes the engine after it. */
const protocolCut = definePoolAction<[string]>({
  name: 'protocolCut',
  sample: drawClient,
  act: (s, clientId) => {
    s.node(clientId).auth('upgrade_required');
    oweRestart(s, clientId);
  },
});

// --- lifecycle -------------------------------------------------------------

const crash = definePoolAction<[string]>({
  name: 'crash',
  sample: drawClient,
  act: async (s, clientId) => {
    if (!s.clients.has(clientId)) return;
    await s.node(clientId).crash();
    oweRestart(s, clientId);
  },
});

async function remake(
  s: SyncHarness,
  clientId: string,
  restart: () => Promise<unknown>
): Promise<void> {
  await prepareRestart(s);
  try {
    await restart();
  } catch (error) {
    // Client removed mid-restart; the wrapper records the owed restart.
    if (!isExpectedRestartFault(error)) throw error;
  }
  if (s.clients.has(clientId)) forgetOwedRestart(s, clientId);
}

const restart = definePoolAction<[string]>({
  name: 'restart',
  sample: drawClient,
  act: (s, clientId) => remake(s, clientId, () => s.node(clientId).restart()),
});

const restartWithSchema = definePoolAction<[string, string]>({
  name: 'restartWithSchema',
  sample: (s) =>
    gen(fc.tuple(pickClient(s), fc.constantFrom(...SCHEMA_VARIANTS))),
  act: (s, clientId, variant) =>
    remake(s, clientId, () =>
      s.node(clientId).restart(
        s.runtime.app.restartOptsForVariant?.(variant) ?? {
          preserveLocalDb: true,
        }
      )
    ),
});

const clearLocalData = definePoolAction<[string]>({
  name: 'clearLocalData',
  sample: drawClient,
  act: async (s, clientId) => {
    await s.clients.get(clientId)?.clearLocalData('pbt');
  },
});

const subscribe = definePoolAction<[string]>({
  name: 'subscribe',
  sample: drawClient,
  act: (s, clientId) => {
    const client = s.clients.get(clientId);
    if (client === undefined) return;
    const q = sessionQueryOf(s);
    s.runtime.poolSubscriptions.add(client.subscribe(q.name, q.params));
  },
});

const serverCrash = definePoolAction<[]>({
  name: 'serverCrash',
  sample: () => gen(fc.constant([] as const)),
  act: async (s) => {
    await s.node('server').crash();
  },
});

/** Bring the server back and reconnect every client that is not owed a remake. */
const serverRestart = definePoolAction<[]>({
  name: 'serverRestart',
  sample: () => gen(fc.constant([] as const)),
  act: async (s) => {
    restoreNetworkForIdle(s);
    for (const [id, client] of s.clients) {
      if (s.runtime.owed.restart.has(id)) continue;
      await client.connect();
    }
    await s.node('server').restart({ preserveLocalDb: true });
  },
});

const skew = definePoolAction<[string, number]>({
  name: 'skew',
  sample: (s) =>
    gen(
      fc.tuple(
        fc.constantFrom(...clientIds(s), 'server'),
        fc.constantFrom(...SKEW_MS_VALUES)
      )
    ),
  act: (s, nodeId, skewMs) => {
    s.node(nodeId).skewClock(skewMs);
  },
});

// --- chaos -----------------------------------------------------------------

/** Tamper, then remake the client immediately so the run can still settle. */
const tamperLocalStorage = definePoolAction<[string, LocalStorageTamper]>({
  name: 'tamperLocalStorage',
  sample: (s) =>
    gen(fc.tuple(pickClient(s), fc.constantFrom(...STORAGE_TAMPERS))),
  act: async (s, clientId, tamper) => {
    await s.tamperLocalStorage(clientId, tamper);
    // Disarm before restoreNetwork so a pending upload cannot crash the live engine
    // in the gap before restartClientForConverge clears arms.
    s.clearEdgeFaults();
    restoreNetworkForIdle(s);
    await restartClientForConverge(s, clientId);
    forgetOwedRestart(s, clientId);
  },
});

const armStoragePressure = definePoolAction<[string, StoragePressureKind]>({
  name: 'armStoragePressure',
  sample: (s) =>
    gen(fc.tuple(pickClient(s), fc.constantFrom(...STORAGE_PRESSURES))),
  act: (s, clientId, pressure) => {
    if (!s.clients.has(clientId)) return;
    s.armStoragePressure(clientId, pressure);
  },
});

const failNextOpen = definePoolAction<[string]>({
  name: 'failNextOpen',
  sample: drawClient,
  act: (s, clientId) => {
    if (!s.clients.has(clientId)) return;
    s.armFailNextOpen(clientId);
  },
});

const brokerCrash = definePoolAction<[]>({
  name: 'brokerCrash',
  sample: () => gen(fc.constant([] as const)),
  act: (s) => s.brokerCrash(),
});

const brokerRestart = definePoolAction<[]>({
  name: 'brokerRestart',
  sample: () => gen(fc.constant([] as const)),
  act: async (s) => {
    restoreNetworkForIdle(s);
    await s.brokerRestart();
  },
});

const pruneServerArtifacts = definePoolAction<[number]>({
  name: 'pruneServerArtifacts',
  sample: () => gen(fc.constant(-1_000_000)),
  act: async (s, olderThanMs) => {
    await s.server.pruneArtifacts(olderThanMs);
  },
});

/** Boot a second engine over a donor's local db (multi-tab / shared cache). */
const addPeerEngine = definePoolAction<[string, string]>({
  name: 'addPeerEngine',
  sample: (s) => {
    const ids = clientIds(s);
    return gen(
      fc.tuple(fc.constant(nextPeerEngineId(ids)), fc.constantFrom(...ids))
    );
  },
  act: async (s, clientId, donorId) => {
    const donor = s.clients.get(donorId);
    if (donor === undefined || s.clients.has(clientId)) return;
    // Revoked / crashed / cut donors hold a closed or doomed handle — a real
    // second tab would open its own db, so skip rather than share it.
    if (s.runtime.owed.restart.has(donorId)) return;
    await s.addClient({
      id: clientId,
      actorId: donor.actorId,
      existingDb: donor.dbBundle,
    });
  },
});

// --- app ops ---------------------------------------------------------------

/** One app mutation drawn from `app.domainOpArbs`; missing clients are skipped. */
const domain = definePoolAction<[DomainOp]>({
  name: 'domain',
  enabled: (s) =>
    hasClients(s) &&
    s.runtime.app.domainOpArbs({ clientIds: clientIds(s) }).length > 0,
  sample: (s) =>
    gen(fc.oneof(...s.runtime.app.domainOpArbs({ clientIds: clientIds(s) }))),
  act: async (s, op) => {
    const client = s.clients.get(op.clientId);
    if (client === undefined) return;
    const mutation = s.runtime.app.pack.mutationRegistry[op.mutation];
    if (mutation === undefined) {
      throw new Error(`unknown mutation: ${op.mutation}`);
    }
    await client.mutate(mutation, op.args);
  },
});

/** One out-of-band server write drawn from `app.serverOpArbs`. */
const server = definePoolAction<[ServerOp]>({
  name: 'server',
  enabled: (s) =>
    (s.runtime.app.serverOpArbs?.({ clientIds: clientIds(s) }).length ?? 0) > 0,
  sample: (s) => {
    const arbs = s.runtime.app.serverOpArbs;
    if (arbs === undefined) {
      throw new Error('server pool action: app has no serverOpArbs');
    }
    return gen(fc.oneof(...arbs({ clientIds: clientIds(s) })));
  },
  act: async (s, op) => {
    const handler = s.runtime.app.serverOps?.[op.name];
    if (handler === undefined) {
      throw new Error(`unknown server op: ${op.name}`);
    }
    await handler(s, op.args);
  },
});

/**
 * Pool actions by name. Recording pins apply these (`s.apply(pool.restart,
 * 'c0')`) to keep walk semantics; explore slices name them as strings.
 */
export const pool = {
  offline,
  online,
  disconnect,
  connect,
  background,
  foreground,
  partition,
  pauseNetwork,
  resumeNetwork,
  setFaults,
  restoreNetwork,
  freeze,
  thaw,
  armHttpFault,
  armCrashAt,
  publishFault,
  armPubsubFault,
  auth,
  protocolCut,
  crash,
  restart,
  restartWithSchema,
  clearLocalData,
  subscribe,
  serverCrash,
  serverRestart,
  skew,
  tamperLocalStorage,
  armStoragePressure,
  failNextOpen,
  brokerCrash,
  brokerRestart,
  pruneServerArtifacts,
  addPeerEngine,
  domain,
  server,
} as const;

/** Existential view of {@link pool} — mixed arities in one registration list. */
export const SYNC_POOL_ACTIONS: readonly CatalogAction<SyncHarness>[] =
  Object.values(pool) as unknown as readonly CatalogAction<SyncHarness>[];
