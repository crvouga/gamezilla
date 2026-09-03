/**
 * Scripted-pin actions for network, boundary faults, crashes, and storage
 * pressure. Companion to `sync-pin-actions.ts` (client / data vocabulary).
 */

import { type Action, defineSurface } from '@pkgs/dst';

import type {
  SimCrashEvent,
  SimHttpFault,
  SimPubsubFault,
} from '../boundary-faults';
import type { RestartClientOpts } from '../kit-lifecycle';
import type { NetState } from '../net-effect';
import type { StoragePressureKind } from '../storage-pressure';
import type { SimTraffic } from '../traffic';
import { requireClient } from './pin-support';
import type { SyncSurface } from './system';

const { defineAction } = defineSurface<SyncSurface>();

export const netSet = defineAction({
  name: 'netSet',
  generate(nodeId: string, traffic: SimTraffic, state: NetState) {
    return (s) => {
      s.net(nodeId, traffic).set(state);
    };
  },
});

export const net = netSet;

function netStatePin(
  name: string,
  state: NetState
): Action<SyncSurface, [string, SimTraffic]> {
  return defineAction({
    name,
    generate(nodeId: string, traffic: SimTraffic) {
      return (s) => {
        s.net(nodeId, traffic).set(state);
      };
    },
  });
}

export const hold = netStatePin('hold', 'hold');
export const release = netStatePin('release', 'ok');
export const partition = netStatePin('partition', 'down');

export const heal = defineAction({
  name: 'heal',
  generate() {
    return (s) => {
      for (const id of s.clients.keys()) s.net(id, 'all').set('ok');
    };
  },
});

export const crash = defineAction({
  name: 'crash',
  generate(nodeId: string) {
    return async (s) => {
      await s.node(nodeId).crash();
    };
  },
});

export const crashAt = defineAction({
  name: 'crashAt',
  generate(clientId: string, event: SimCrashEvent) {
    return (s) => {
      void s.node(clientId).crash({ at: event });
    };
  },
});

export const restart = defineAction({
  name: 'restart',
  generate(nodeId: string, opts?: RestartClientOpts) {
    return async (s) => {
      await s.node(nodeId).restart(opts);
    };
  },
});

export const restartWithSchema = defineAction({
  name: 'restartWithSchema',
  generate(clientId: string, variant: string) {
    return async (s) => {
      const opts = s.runtime.app.restartOptsForVariant?.(variant) ?? {
        preserveLocalDb: true,
      };
      await s.node(clientId).restart(opts);
    };
  },
});

export const skewClock = defineAction({
  name: 'skewClock',
  generate(nodeId: string, skewMs: number) {
    return (s) => {
      s.node(nodeId).skewClock(skewMs);
    };
  },
});

export const httpFault = defineAction({
  name: 'httpFault',
  generate(clientId: string, fault: SimHttpFault) {
    return (s) => {
      s.node(clientId).httpFault(fault);
    };
  },
});

/**
 * Drop the server's next `count` fanout publishes — `run.apply(publishFault,
 * 'next')`. The arm is one-shot per publish, so it needs no scoped release.
 */
export const publishFault = defineAction({
  name: 'publishFault',
  generate(count: number | 'next') {
    return (s) => {
      s.node('server').publishFault(count);
    };
  },
});

/** Arm a server pubsub-boundary fault — `run.apply(pubsubFault, fault)`. */
export const pubsubFault = defineAction({
  name: 'pubsubFault',
  generate(fault: SimPubsubFault) {
    return (s) => {
      s.node('server').pubsubFault(fault);
    };
  },
});

export const brokerCrash = defineAction({
  name: 'brokerCrash',
  generate() {
    return (s) => {
      s.brokerCrash();
    };
  },
});

export const brokerRestart = defineAction({
  name: 'brokerRestart',
  generate() {
    return async (s) => {
      await s.brokerRestart();
    };
  },
});

/**
 * `run.apply(armStoragePressure, 'c0', 'sqliteFull')`, or
 * `run.apply(armStoragePressure, 'c0', { kind: 'sqliteFull', after: 2 })` to
 * let the first N statements through.
 */
export const armStoragePressure = defineAction({
  name: 'armStoragePressure',
  generate(
    clientId: string,
    pressure: StoragePressureKind | { kind: StoragePressureKind; after: number }
  ) {
    return (s) => {
      if (typeof pressure === 'string') {
        s.armStoragePressure(clientId, pressure);
        return;
      }
      s.armStoragePressure(clientId, pressure.kind, pressure.after);
    };
  },
});

export const clearStoragePressure = defineAction({
  name: 'clearStoragePressure',
  generate(clientId: string) {
    return (s) => {
      s.clearStoragePressure(clientId);
    };
  },
});

export const tamperLocalStorage = defineAction({
  name: 'tamperLocalStorage',
  generate(
    clientId: string,
    tamper: Parameters<SyncSurface['tamperLocalStorage']>[1]
  ) {
    return async (s) => {
      await s.tamperLocalStorage(clientId, tamper);
    };
  },
});

export const failNextOpen = defineAction({
  name: 'failNextOpen',
  generate(clientId: string) {
    return (s) => {
      s.armFailNextOpen(clientId);
    };
  },
});

export const serverPrune = defineAction({
  name: 'serverPrune',
  generate(olderThanMs: number) {
    return async (s) => {
      await s.server.pruneArtifacts(olderThanMs);
    };
  },
});

export const addPeerEngine = defineAction({
  name: 'addPeerEngine',
  generate(clientId: string, donorId: string) {
    return async (s) => {
      const donor = requireClient(s, donorId);
      await s.addClient({
        id: clientId,
        actorId: donor.actorId,
        existingDb: donor.dbBundle,
      });
    };
  },
});

export const serverOp = defineAction({
  name: 'serverOp',
  generate(name: string, args: Record<string, unknown>) {
    return async (s) => {
      const handler = s.runtime.app.serverOps?.[name];
      if (handler === undefined) {
        throw new Error(`sync pin: unknown server op '${name}'`);
      }
      await handler(s, args);
    };
  },
});

export const auth = defineAction({
  name: 'auth',
  generate(
    clientId: string,
    status: 'valid' | 'expired' | 'revoked' | 'upgrade_required'
  ) {
    return async (s) => {
      s.node(clientId).auth(status);
      if (status === 'revoked') {
        const client = s.clients.get(clientId);
        if (client !== undefined) await client.disconnect();
      }
    };
  },
});
