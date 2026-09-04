/**
 * Scripted-pin actions for network, boundary faults, crashes, and storage
 * pressure. Companion to `regression-actions.ts` (client / data vocabulary).
 */

import { type Action, defineAction } from '@pkgs/sim';

import type {
  SimCrashEvent,
  SimHttpFault,
  SimPubsubFault,
} from '../edge-faults';
import type { NetState } from '../net-effect';
import type { RestartClientOpts } from '../sim-lifecycle';
import type { StoragePressureKind } from '../storage-pressure';
import type { SimTraffic } from '../traffic';
import { requireClient } from './regression-support';
import type { SyncSim } from './system';

export const netSet = defineAction({
  name: 'netSet',
  act: (s: SyncSim, nodeId: string, traffic: string, state: NetState) => {
    s.net(nodeId, traffic as SimTraffic).set(state);
  },
});

export const net = netSet;

function netStatePin(
  name: string,
  state: NetState
): Action<SyncSim, [string, string]> {
  return defineAction({
    name,
    act: (s: SyncSim, nodeId: string, traffic: string) => {
      s.net(nodeId, traffic as SimTraffic).set(state);
    },
  });
}

export const pauseNetwork = netStatePin('pauseNetwork', 'hold');
export const resumeNetwork = netStatePin('resumeNetwork', 'ok');
export const partition = netStatePin('partition', 'down');

export const restoreNetwork = defineAction({
  name: 'restoreNetwork',
  act: (s: SyncSim) => {
    for (const id of s.clients.keys()) s.net(id, 'all').set('ok');
  },
});

export const crash = defineAction({
  name: 'crash',
  act: async (s: SyncSim, nodeId: string) => {
    await s.node(nodeId).crash();
  },
});

export const crashAt = defineAction({
  name: 'crashAt',
  act: (s: SyncSim, clientId: string, event: string) => {
    void s.node(clientId).crash({ at: event as SimCrashEvent });
  },
});

export const restart = defineAction({
  name: 'restart',
  act: async (s: SyncSim, nodeId: string, opts?: RestartClientOpts) => {
    await s.node(nodeId).restart(opts);
  },
});

export const restartWithSchema = defineAction({
  name: 'restartWithSchema',
  act: async (s: SyncSim, clientId: string, variant: string) => {
    const opts = s.runtime.app.restartOptsForVariant?.(variant) ?? {
      preserveLocalDb: true,
    };
    await s.node(clientId).restart(opts);
  },
});

export const skewClock = defineAction({
  name: 'skewClock',
  act: (s: SyncSim, nodeId: string, skewMs: number) => {
    s.node(nodeId).skewClock(skewMs);
  },
});

export const httpFault = defineAction({
  name: 'httpFault',
  act: (s: SyncSim, clientId: string, fault: SimHttpFault) => {
    s.node(clientId).httpFault(fault);
  },
});

/**
 * Drop the server's next `count` fanout publishes — `s.apply(publishFault,
 * 'next')`. The arm is one-shot per publish, so it needs no scoped release.
 */
export const publishFault = defineAction({
  name: 'publishFault',
  act: (s: SyncSim, count: number | 'next') => {
    s.node('server').publishFault(count);
  },
});

/** Arm a server pubsub-boundary fault — `s.apply(pubsubFault, fault)`. */
export const pubsubFault = defineAction({
  name: 'pubsubFault',
  act: (s: SyncSim, fault: SimPubsubFault) => {
    s.node('server').pubsubFault(fault);
  },
});

export const brokerCrash = defineAction({
  name: 'brokerCrash',
  act: (s: SyncSim) => {
    s.brokerCrash();
  },
});

export const brokerRestart = defineAction({
  name: 'brokerRestart',
  act: async (s: SyncSim) => {
    await s.brokerRestart();
  },
});

/**
 * `s.apply(armStoragePressure, 'c0', 'sqliteFull')`, or
 * `s.apply(armStoragePressure, 'c0', { kind: 'sqliteFull', after: 2 })` to
 * let the first N statements through.
 */
export const armStoragePressure = defineAction({
  name: 'armStoragePressure',
  act: (
    s: SyncSim,
    clientId: string,
    pressure: StoragePressureKind | { kind: StoragePressureKind; after: number }
  ) => {
    if (typeof pressure === 'string') {
      s.armStoragePressure(clientId, pressure);
      return;
    }
    s.armStoragePressure(clientId, pressure.kind, pressure.after);
  },
});

export const clearStoragePressure = defineAction({
  name: 'clearStoragePressure',
  act: (s: SyncSim, clientId: string) => {
    s.clearStoragePressure(clientId);
  },
});

export const tamperLocalStorage = defineAction({
  name: 'tamperLocalStorage',
  act: async (
    s: SyncSim,
    clientId: string,
    tamper: Parameters<SyncSim['tamperLocalStorage']>[1]
  ) => {
    await s.tamperLocalStorage(clientId, tamper);
  },
});

export const failNextOpen = defineAction({
  name: 'failNextOpen',
  act: (s: SyncSim, clientId: string) => {
    s.armFailNextOpen(clientId);
  },
});

export const serverPrune = defineAction({
  name: 'serverPrune',
  act: async (s: SyncSim, olderThanMs: number) => {
    await s.server.pruneArtifacts(olderThanMs);
  },
});

export const addPeerEngine = defineAction({
  name: 'addPeerEngine',
  act: async (s: SyncSim, clientId: string, donorId: string) => {
    const donor = requireClient(s, donorId);
    await s.addClient({
      id: clientId,
      actorId: donor.actorId,
      existingDb: donor.dbBundle,
    });
  },
});

export const serverOp = defineAction({
  name: 'serverOp',
  act: async (s: SyncSim, name: string, args: Record<string, unknown>) => {
    const handler = s.runtime.app.serverOps?.[name];
    if (handler === undefined) {
      throw new Error(`sync pin: unknown server op '${name}'`);
    }
    await handler(s, args);
  },
});

export const auth = defineAction({
  name: 'auth',
  act: async (s: SyncSim, clientId: string, status: string) => {
    const authStatus = status as
      | 'valid'
      | 'expired'
      | 'revoked'
      | 'upgrade_required';
    s.node(clientId).auth(authStatus);
    if (authStatus === 'revoked') {
      const client = s.clients.get(clientId);
      if (client !== undefined) await client.disconnect();
    }
  },
});
