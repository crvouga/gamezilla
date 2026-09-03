import { type Action, defineAction, draw, observe } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import type { RoomCrashEvent } from '../boundary-faults';
import type { RoomNetSetArg } from '../network';
import { ROOM_SERVER_ENDPOINT, roomClientEndpoint } from '../network';
import type { DomainOp } from './actions';
import type { RoomApp } from './app';
import { MILD_NET_FAULTS } from './library-arbs';
import {
  caps,
  clientIds,
  connected,
  crashedIds,
  downClients,
  heldClients,
  partitioned,
  serverCrashed,
} from './observations';
import { prepareClientsForConverge } from './play';
import type { RoomSurface } from './surface';

function asIds(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string')
    : [];
}

function pickId(ids: readonly string[]) {
  return draw(gen(fc.constantFrom(...(ids as [string, ...string[]]))));
}

async function drainAct(
  s: RoomSurface,
  fn: () => unknown | Promise<unknown>
): Promise<void> {
  await fn();
  await s.kit.drain();
}

function clientKind(
  name: string,
  act: (s: RoomSurface, id: string) => unknown | Promise<unknown>
): Action<RoomSurface> {
  return defineAction({
    name,
    *generate() {
      const ids = asIds(yield* clientIds);
      if (ids.length === 0) return;
      const id = yield* pickId(ids);
      yield {
        weight: 1,
        act: (s: RoomSurface) => drainAct(s, () => act(s, id)),
      };
    },
  });
}

export const addClient = defineAction({
  name: 'addClient',
  *generate() {
    const spec = yield* draw(
      gen(fc.record({ id: fc.string({ minLength: 1, maxLength: 16 }) }))
    );
    yield {
      weight: 1,
      act: async (s: RoomSurface) => {
        if (s.kit.clients.has(spec.id)) return;
        await s.kit.addClient(spec);
        await s.kit.drain();
      },
    };
  },
});

export const dispatch = defineAction({
  name: 'dispatch',
  *generate() {
    const ids = asIds(yield* clientIds);
    if (ids.length === 0) return;
    const spec = yield* draw(
      (rng) =>
        ({
          clientId: ids[Math.floor(rng.next() * ids.length)]!,
          payload: null as unknown,
        }) as { readonly clientId: string; readonly payload: unknown }
    );
    yield {
      weight: 1,
      act: async (s: RoomSurface) => {
        const c = s.kit.clients.get(spec.clientId);
        if (c === undefined || spec.payload == null) return;
        c.dispatch(spec.payload as never);
        await s.kit.drain();
      },
    };
  },
});

export const domain = defineAction({
  name: 'domain',
  *generate() {
    const ids = asIds(yield* connected);
    if (ids.length === 0) return;
    const op = yield* draw(
      gen(
        fc.record({
          kind: fc.constant('domain' as const),
          clientId: fc.constantFrom(...(ids as [string, ...string[]])),
          command: fc.string({ minLength: 1, maxLength: 16 }),
          args: fc.constant({} as Record<string, unknown>),
        })
      )
    );
    yield {
      weight: 1,
      act: async (s: RoomSurface) => {
        const c = s.kit.clients.get(op.clientId);
        if (c === undefined) return;
        c.dispatch(s.app.toPayload(op as DomainOp));
        await s.kit.drain();
      },
    };
  },
});

export function domainAction(app: RoomApp): Action<RoomSurface> {
  return defineAction({
    name: 'domain',
    *generate() {
      const ids = asIds(yield* connected);
      if (ids.length === 0) return;
      const arbs = app.domainOpArbs({ clientIds: ids });
      if (arbs.length === 0) return;
      const op = yield* draw(gen(fc.oneof(...arbs)));
      yield {
        weight: 1,
        act: async (s: RoomSurface) => {
          const c = s.kit.clients.get(op.clientId);
          if (c === undefined) return;
          c.dispatch(s.app.toPayload(op));
          await s.kit.drain();
        },
      };
    },
  });
}

export const hold = clientKind('hold', (s, id) => s.kit.net(id).set('hold'));
export const release = clientKind('release', (s, id) =>
  s.kit.net(id).set('ok')
);
export const down = clientKind('down', (s, id) => s.kit.net(id).set('down'));
export const disconnect = clientKind('disconnect', async (s, id) => {
  await s.kit.clients.get(id)?.disconnect();
});
export const connect = clientKind('connect', async (s, id) => {
  await s.kit.clients.get(id)?.connect();
});
export const takeOver = clientKind('takeOver', async (s, id) => {
  await s.kit.node(id).takeOver();
});
export const crash = defineAction({
  name: 'crash',
  *generate() {
    const crashed = new Set(asIds(yield* crashedIds));
    const ids = asIds(yield* clientIds).filter((id) => !crashed.has(id));
    if (ids.length === 0) return;
    const id = yield* pickId(ids);
    yield {
      weight: 1,
      act: (s: RoomSurface) => drainAct(s, () => s.kit.node(id).crash()),
    };
  },
});
export const restart = clientKind('restart', async (s, id) => {
  const c = s.kit.clients.get(id);
  if (c !== undefined && !c.isCrashed()) await s.kit.node(id).crash();
  await s.kit.node(id).restart();
});

export const serverCrash = defineAction({
  name: 'serverCrash',
  *generate() {
    if (yield* serverCrashed) return;
    yield { weight: 1, act: (s: RoomSurface) => s.kit.serverCrash() };
  },
});

export const serverRestart = defineAction({
  name: 'serverRestart',
  *generate() {
    if (!(yield* serverCrashed)) return;
    yield {
      weight: 1,
      act: (s: RoomSurface) => drainAct(s, () => s.kit.serverRestart()),
    };
  },
});

export const partition = defineAction({
  name: 'partition',
  *generate() {
    const [c, ids, cut] = yield* observe(caps, clientIds, partitioned);
    if (!asIds(c).includes('partition') || asIds(ids).length === 0) return;
    const id = yield* pickId(asIds(ids));
    yield {
      weight: asIds(cut).length === 0 ? 2 : 1,
      act: (s: RoomSurface) => {
        s.session.network.partition(
          ROOM_SERVER_ENDPOINT,
          roomClientEndpoint(id)
        );
      },
    };
  },
});

export const heal = defineAction({
  name: 'heal',
  *generate() {
    const [c, cut, held, down] = yield* observe(
      caps,
      partitioned,
      heldClients,
      downClients
    );
    const n = asIds(cut).length + asIds(held).length + asIds(down).length;
    yield {
      weight: Math.max(1, n),
      act: async (s: RoomSurface) => {
        if (asIds(c).includes('partition')) s.session.network.healAll();
        for (const id of s.kit.clients.keys()) s.kit.net(id).set('ok');
        await s.kit.drain();
      },
    };
  },
});

export const passTime = defineAction({
  name: 'passTime',
  *generate() {
    if (!asIds(yield* caps).includes('virtualTime')) return;
    const ms = yield* draw((rng) => 1 + Math.floor(rng.next() * 40));
    yield { weight: 1, act: (s: RoomSurface) => s.kit.runFor(ms) };
  },
});

export const converge = defineAction({
  name: 'converge',
  *generate() {
    yield {
      weight: 1,
      act: async (s: RoomSurface) => {
        await prepareClientsForConverge(s.kit);
        await s.kit.assertConverged();
      },
    };
  },
});

export const clearFaults = defineAction({
  name: 'clearFaults',
  *generate() {
    yield {
      weight: 1,
      act: (s: RoomSurface) => s.kit.clearBoundaryFaults(),
    };
  },
});

export const armCrashAt = defineAction({
  name: 'armCrashAt',
  *generate() {
    const ids = asIds(yield* connected);
    if (ids.length === 0) return;
    const spec = yield* draw(
      gen(
        fc.record({
          clientId: fc.constantFrom(...(ids as [string, ...string[]])),
          event: fc.constant('afterNextCommitted' as RoomCrashEvent),
        })
      )
    );
    yield {
      weight: 1,
      act: (s: RoomSurface) => {
        s.kit.armCrashAt(spec.clientId, spec.event);
      },
    };
  },
});

export const injectToServer = defineAction({
  name: 'injectToServer',
  *generate() {
    const ids = asIds(yield* clientIds);
    if (ids.length === 0) return;
    const spec = yield* draw(
      (rng) =>
        ({
          clientId: ids[Math.floor(rng.next() * ids.length)]!,
          raw: null as unknown,
          direct: true,
        }) as {
          readonly clientId: string;
          readonly raw: unknown;
          readonly direct?: boolean;
        }
    );
    yield {
      weight: 1,
      act: async (s: RoomSurface) => {
        s.kit.clients.get(spec.clientId)?.injectToServer(spec.raw, {
          ...(spec.direct === true ? { direct: true } : {}),
        });
        await s.kit.drain();
      },
    };
  },
});

export const injectFromServer = defineAction({
  name: 'injectFromServer',
  *generate() {
    const ids = asIds(yield* clientIds);
    if (ids.length === 0) return;
    const spec = yield* draw(
      (rng) =>
        ({
          clientId: ids[Math.floor(rng.next() * ids.length)]!,
          raw: null as unknown,
        }) as { readonly clientId: string; readonly raw: unknown }
    );
    yield {
      weight: 1,
      act: async (s: RoomSurface) => {
        s.kit.clients.get(spec.clientId)?.injectFromServer(spec.raw);
        await s.kit.drain();
      },
    };
  },
});

export const setNet = defineAction({
  name: 'setNet',
  *generate() {
    const ids = asIds(yield* clientIds);
    if (ids.length === 0) return;
    const spec = yield* draw(
      (rng) =>
        ({
          clientId: ids[Math.floor(rng.next() * ids.length)]!,
          next: 'ok' as RoomNetSetArg,
        }) as { readonly clientId: string; readonly next: RoomNetSetArg }
    );
    yield {
      weight: 1,
      act: (s: RoomSurface) => {
        s.kit.net(spec.clientId).set(spec.next);
      },
    };
  },
});

export const setFaults = clientKind('setFaults', (s, id) => {
  s.kit.net(id).set(MILD_NET_FAULTS);
});
export const asymmetricLink = clientKind('asymmetricLink', (s, id) => {
  s.kit.net(id).set({ toClient: 'hold', toServer: 'ok' });
});
export const clearLocalData = clientKind('clearLocalData', async (s, id) => {
  await s.kit.node(id).clearLocalData();
});

export const addSpectator = defineAction({
  name: 'addSpectator',
  *generate() {
    yield {
      weight: 1,
      act: async (s: RoomSurface) => {
        if (s.kit.clients.has('spec0')) return;
        await s.kit.addClient({
          id: 'spec0',
          identity: 'spectator',
          clientId: 'spec-tab',
        });
        await s.kit.drain();
      },
    };
  },
});

export const LIBRARY_ACTIONS: readonly Action<RoomSurface>[] = [
  hold,
  release,
  down,
  heal,
  passTime,
  partition,
  crash,
  restart,
  disconnect,
  connect,
  takeOver,
  serverCrash,
  serverRestart,
  setFaults,
  asymmetricLink,
  addSpectator,
  clearLocalData,
];

export function roomActions(app: RoomApp): Action<RoomSurface>[] {
  return [domainAction(app), ...LIBRARY_ACTIONS];
}

export const ROOM_ACTIONS = LIBRARY_ACTIONS;
