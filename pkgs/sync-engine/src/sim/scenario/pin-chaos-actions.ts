/**
 * Scripted-pin actions for network, boundary faults, crashes, and storage
 * pressure. Companion to `sync-pin-actions.ts` (client / data vocabulary).
 */

import { type Action, defineAction } from '@pkgs/dst';

import type {
  SimCrashEvent,
  SimHttpFault,
  SimPubsubFault,
} from '../boundary-faults';
import type { RestartClientOpts } from '../kit-lifecycle';
import type { NetState } from '../net-effect';
import type { StoragePressureKind } from '../storage-pressure';
import type { SimTraffic } from '../traffic';
import { pin, requireClient } from './pin-support';
import type { SyncSurface } from './system';

export const netSet = defineAction({
  name: 'netSet',
  *generate() {
    const nodeId = yield* pin<string>();
    if (nodeId === undefined) return;
    const traffic = yield* pin<SimTraffic>();
    if (traffic === undefined) return;
    const state = yield* pin<NetState>();
    if (state === undefined) return;
    yield {
      weight: 1,
      act: (s: SyncSurface) => {
        s.net(nodeId, traffic).set(state);
      },
    };
  },
});

export const net = netSet;

function netStatePin(name: string, state: NetState): Action<SyncSurface> {
  return defineAction({
    name,
    *generate() {
      const nodeId = yield* pin<string>();
      if (nodeId === undefined) return;
      const traffic = yield* pin<SimTraffic>();
      if (traffic === undefined) return;
      yield {
        weight: 1,
        act: (s: SyncSurface) => {
          s.net(nodeId, traffic).set(state);
        },
      };
    },
  });
}

export const hold = netStatePin('hold', 'hold');
export const release = netStatePin('release', 'ok');
export const partition = netStatePin('partition', 'down');

export const heal = defineAction({
  name: 'heal',
  *generate() {
    yield {
      weight: 1,
      act: (s: SyncSurface) => {
        for (const id of s.clients.keys()) s.net(id, 'all').set('ok');
      },
    };
  },
});

export const crash = defineAction({
  name: 'crash',
  *generate() {
    const nodeId = yield* pin<string>();
    if (nodeId === undefined) return;
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        await s.node(nodeId).crash();
      },
    };
  },
});

export const crashAt = defineAction({
  name: 'crashAt',
  *generate() {
    const clientId = yield* pin<string>();
    if (clientId === undefined) return;
    const event = yield* pin<SimCrashEvent>();
    if (event === undefined) return;
    yield {
      weight: 1,
      act: (s: SyncSurface) => {
        void s.node(clientId).crash({ at: event });
      },
    };
  },
});

export const restart = defineAction({
  name: 'restart',
  *generate() {
    const nodeId = yield* pin<string>();
    if (nodeId === undefined) return;
    const opts = yield* pin<RestartClientOpts>();
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        await s.node(nodeId).restart(opts);
      },
    };
  },
});

export const restartWithSchema = defineAction({
  name: 'restartWithSchema',
  *generate() {
    const clientId = yield* pin<string>();
    if (clientId === undefined) return;
    const variant = yield* pin<string>();
    if (variant === undefined) return;
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        const opts = s.runtime.app.restartOptsForVariant?.(variant) ?? {
          preserveLocalDb: true,
        };
        await s.node(clientId).restart(opts);
      },
    };
  },
});

export const skewClock = defineAction({
  name: 'skewClock',
  *generate() {
    const nodeId = yield* pin<string>();
    if (nodeId === undefined) return;
    const skewMs = yield* pin<number>();
    if (skewMs === undefined) return;
    yield {
      weight: 1,
      act: (s: SyncSurface) => {
        s.node(nodeId).skewClock(skewMs);
      },
    };
  },
});

export const httpFault = defineAction({
  name: 'httpFault',
  *generate() {
    const clientId = yield* pin<string>();
    if (clientId === undefined) return;
    const fault = yield* pin<SimHttpFault>();
    if (fault === undefined) return;
    yield {
      weight: 1,
      act: (s: SyncSurface) => {
        s.node(clientId).httpFault(fault);
      },
    };
  },
});

/**
 * Drop the server's next `count` fanout publishes — `run.apply(publishFault,
 * 'next')`. The arm is one-shot per publish, so it needs no scoped release.
 */
export const publishFault = defineAction({
  name: 'publishFault',
  *generate() {
    const count = yield* pin<number | 'next'>();
    if (count === undefined) return;
    yield {
      weight: 1,
      act: (s: SyncSurface) => {
        s.node('server').publishFault(count);
      },
    };
  },
});

/** Arm a server pubsub-boundary fault — `run.apply(pubsubFault, fault)`. */
export const pubsubFault = defineAction({
  name: 'pubsubFault',
  *generate() {
    const fault = yield* pin<SimPubsubFault>();
    if (fault === undefined) return;
    yield {
      weight: 1,
      act: (s: SyncSurface) => {
        s.node('server').pubsubFault(fault);
      },
    };
  },
});

export const brokerCrash = defineAction({
  name: 'brokerCrash',
  *generate() {
    yield {
      weight: 1,
      act: (s: SyncSurface) => {
        s.brokerCrash();
      },
    };
  },
});

export const brokerRestart = defineAction({
  name: 'brokerRestart',
  *generate() {
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        await s.brokerRestart();
      },
    };
  },
});

/**
 * `run.apply(armStoragePressure, 'c0', 'sqliteFull')`, or
 * `run.apply(armStoragePressure, 'c0', { kind: 'sqliteFull', after: 2 })` to
 * let the first N statements through. A trailing optional pin is not an
 * option — scripted draws throw once the caller's argument list runs out.
 */
export const armStoragePressure = defineAction({
  name: 'armStoragePressure',
  *generate() {
    const clientId = yield* pin<string>();
    if (clientId === undefined) return;
    const pressure = yield* pin<
      StoragePressureKind | { kind: StoragePressureKind; after: number }
    >();
    if (pressure === undefined) return;
    yield {
      weight: 1,
      act: (s: SyncSurface) => {
        if (typeof pressure === 'string') {
          s.armStoragePressure(clientId, pressure);
          return;
        }
        s.armStoragePressure(clientId, pressure.kind, pressure.after);
      },
    };
  },
});

export const clearStoragePressure = defineAction({
  name: 'clearStoragePressure',
  *generate() {
    const clientId = yield* pin<string>();
    yield {
      weight: 1,
      act: (s: SyncSurface) => {
        s.clearStoragePressure(clientId);
      },
    };
  },
});

export const tamperLocalStorage = defineAction({
  name: 'tamperLocalStorage',
  *generate() {
    const clientId = yield* pin<string>();
    if (clientId === undefined) return;
    const tamper =
      yield* pin<Parameters<SyncSurface['tamperLocalStorage']>[1]>();
    if (tamper === undefined) return;
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        await s.tamperLocalStorage(clientId, tamper);
      },
    };
  },
});

export const failNextOpen = defineAction({
  name: 'failNextOpen',
  *generate() {
    const clientId = yield* pin<string>();
    if (clientId === undefined) return;
    yield {
      weight: 1,
      act: (s: SyncSurface) => {
        s.armFailNextOpen(clientId);
      },
    };
  },
});

export const serverPrune = defineAction({
  name: 'serverPrune',
  *generate() {
    const olderThanMs = yield* pin<number>();
    if (olderThanMs === undefined) return;
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        await s.server.pruneArtifacts(olderThanMs);
      },
    };
  },
});

export const addPeerEngine = defineAction({
  name: 'addPeerEngine',
  *generate() {
    const clientId = yield* pin<string>();
    if (clientId === undefined) return;
    const donorId = yield* pin<string>();
    if (donorId === undefined) return;
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        const donor = requireClient(s, donorId);
        await s.addClient({
          id: clientId,
          actorId: donor.actorId,
          existingDb: donor.dbBundle,
        });
      },
    };
  },
});

export const serverOp = defineAction({
  name: 'serverOp',
  *generate() {
    const name = yield* pin<string>();
    if (name === undefined) return;
    const args = yield* pin<Record<string, unknown>>();
    if (args === undefined) return;
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        const handler = s.runtime.app.serverOps?.[name];
        if (handler === undefined) {
          throw new Error(`sync pin: unknown server op '${name}'`);
        }
        await handler(s, args);
      },
    };
  },
});

export const auth = defineAction({
  name: 'auth',
  *generate() {
    const clientId = yield* pin<string>();
    if (clientId === undefined) return;
    const status = yield* pin<
      'valid' | 'expired' | 'revoked' | 'upgrade_required'
    >();
    if (status === undefined) return;
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        s.node(clientId).auth(status);
        if (status === 'revoked') {
          const client = s.clients.get(clientId);
          if (client !== undefined) await client.disconnect();
        }
      },
    };
  },
});
