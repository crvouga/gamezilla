/**
 * Scripted-pin actions for network, boundary faults, crashes, and storage
 * pressure. Companion to `regression-actions.ts` (client / data vocabulary).
 */

import { defineAction } from '@pkgs/harness-shared/define-action';
import type { Action } from '@pkgs/harness-shared/effect';
import type { HarnessPubsubFault } from './edge-fault-pubsub';
import type { HarnessCrashEvent, HarnessHttpFault } from './edge-faults';
import type { RestartClientOpts } from './lifecycle';
import type { NetState } from './net-effect';
import { requireClient } from './regression-support';
import type { SyncHarness } from './scenario-system';
import type { StoragePressureKind } from './storage-pressure';
import type { HarnessTraffic } from './traffic';

export const netSet = defineAction({
  name: 'netSet',
  act: (s: SyncHarness, nodeId: string, traffic: string, state: NetState) => {
    s.net(nodeId, traffic as HarnessTraffic).set(state);
  },
});

export const net = netSet;

function netStatePin(
  name: string,
  state: NetState
): Action<SyncHarness, [string, string]> {
  return defineAction({
    name,
    act: (s: SyncHarness, nodeId: string, traffic: string) => {
      s.net(nodeId, traffic as HarnessTraffic).set(state);
    },
  });
}

export const pauseNetwork = netStatePin('pauseNetwork', 'hold');
export const resumeNetwork = netStatePin('resumeNetwork', 'ok');
export const partition = netStatePin('partition', 'down');

export const restoreNetwork = defineAction({
  name: 'restoreNetwork',
  act: (s: SyncHarness) => {
    for (const id of s.clients.keys()) s.net(id, 'all').set('ok');
  },
});

export const crash = defineAction({
  name: 'crash',
  act: async (s: SyncHarness, nodeId: string) => {
    await s.node(nodeId).crash();
  },
});

export const crashAt = defineAction({
  name: 'crashAt',
  act: (s: SyncHarness, clientId: string, event: string) => {
    void s.node(clientId).crash({ at: event as HarnessCrashEvent });
  },
});

export const restart = defineAction({
  name: 'restart',
  act: async (s: SyncHarness, nodeId: string, opts?: RestartClientOpts) => {
    await s.node(nodeId).restart(opts);
  },
});

export const restartWithSchema = defineAction({
  name: 'restartWithSchema',
  act: async (s: SyncHarness, clientId: string, variant: string) => {
    const opts = s.runtime.app.restartOptsForVariant?.(variant) ?? {
      preserveLocalDb: true,
    };
    await s.node(clientId).restart(opts);
  },
});

export const skewClock = defineAction({
  name: 'skewClock',
  act: (s: SyncHarness, nodeId: string, skewMs: number) => {
    s.node(nodeId).skewClock(skewMs);
  },
});

export const httpFault = defineAction({
  name: 'httpFault',
  act: (s: SyncHarness, clientId: string, fault: HarnessHttpFault) => {
    s.node(clientId).httpFault(fault);
  },
});

/**
 * Drop the server's next `count` fanout publishes — `s.apply(publishFault,
 * 'next')`. The arm is one-shot per publish, so it needs no scoped release.
 */
export const publishFault = defineAction({
  name: 'publishFault',
  act: (s: SyncHarness, count: number | 'next') => {
    s.node('server').publishFault(count);
  },
});

/** Arm a server pubsub-boundary fault — `s.apply(pubsubFault, fault)`. */
export const pubsubFault = defineAction({
  name: 'pubsubFault',
  act: (s: SyncHarness, fault: HarnessPubsubFault) => {
    s.node('server').pubsubFault(fault);
  },
});

export const brokerCrash = defineAction({
  name: 'brokerCrash',
  act: (s: SyncHarness) => {
    s.brokerCrash();
  },
});

export const brokerRestart = defineAction({
  name: 'brokerRestart',
  act: async (s: SyncHarness) => {
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
    s: SyncHarness,
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
  act: (s: SyncHarness, clientId: string) => {
    s.clearStoragePressure(clientId);
  },
});

export const tamperLocalStorage = defineAction({
  name: 'tamperLocalStorage',
  act: async (
    s: SyncHarness,
    clientId: string,
    tamper: Parameters<SyncHarness['tamperLocalStorage']>[1]
  ) => {
    await s.tamperLocalStorage(clientId, tamper);
  },
});

export const failNextOpen = defineAction({
  name: 'failNextOpen',
  act: (s: SyncHarness, clientId: string) => {
    s.armFailNextOpen(clientId);
  },
});

export const serverPrune = defineAction({
  name: 'serverPrune',
  act: async (s: SyncHarness, olderThanMs: number) => {
    await s.server.pruneArtifacts(olderThanMs);
  },
});

export const addPeerEngine = defineAction({
  name: 'addPeerEngine',
  act: async (s: SyncHarness, clientId: string, donorId: string) => {
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
  act: async (s: SyncHarness, name: string, args: Record<string, unknown>) => {
    const handler = s.runtime.app.serverOps?.[name];
    if (handler === undefined) {
      throw new Error(`sync pin: unknown server op '${name}'`);
    }
    await handler(s, args);
  },
});

export const auth = defineAction({
  name: 'auth',
  act: async (s: SyncHarness, clientId: string, status: string) => {
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
