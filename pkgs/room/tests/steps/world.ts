/**
 * The world a room engine scenario runs in: at most one `RoomServer` rig and
 * one `RoomClient` rig, each on the cursor module and deterministic ports,
 * plus values a step hands to a later one. The first `When` of a scenario
 * notes what the client looked like before it, so a `Then` can say what the
 * action changed.
 */

import {
  defineParameterType,
  type ScenarioContext,
  setWorld,
  stepsFor,
} from '@pkgs/gherkin/registry';
import type { RoomState } from '@pkgs/room';
import type { ClientRig } from './client-rig';
import type { ServerRig } from './server-rig';

export type Before = {
  readonly handles: number;
  readonly snapshot: RoomState;
};

export type EngineWorld = {
  readonly ctx: ScenarioContext;
  server: ServerRig | null;
  client: ClientRig | null;
  /** The client as it was when the scenario first acted. */
  before: Before | null;
  readonly memo: Map<string, unknown>;
};

export const { Given, When, Then } = stepsFor<EngineWorld>();

export function serverRig(w: EngineWorld): ServerRig {
  if (w.server === null) {
    throw new Error('no room server — a Given must start one');
  }
  return w.server;
}

export function clientRig(w: EngineWorld): ClientRig {
  if (w.client === null) {
    throw new Error('no room client — a step must open one');
  }
  return w.client;
}

export function before(w: EngineWorld): Before {
  if (w.before === null) throw new Error('the scenario has not acted yet');
  return w.before;
}

export function remember<T>(w: EngineWorld, key: string, value: T): T {
  w.memo.set(key, value);
  return value;
}

export function recall<T>(w: EngineWorld, key: string): T {
  if (!w.memo.has(key)) {
    throw new Error(`no earlier step remembered "${key}"`);
  }
  return w.memo.get(key) as T;
}

defineParameterType({
  name: 'person',
  regexp: /alice|bob/,
  transformer: (name) => name,
});

defineParameterType({
  name: 'people',
  regexp: /[a-z]+(?:(?:, | and )[a-z]+)*/,
  transformer: (list) => list.split(/, | and /),
});

defineParameterType({
  name: 'ints',
  regexp: /\d+(?:(?:, | and )\d+)*/,
  transformer: (list) => list.split(/, | and /).map(Number),
});

export function useEngineWorld(): void {
  setWorld<EngineWorld>({
    create: async (ctx) => ({
      ctx,
      server: null,
      client: null,
      before: null,
      memo: new Map(),
    }),
    dispose: async (w) => {
      w.client?.room.destroy();
    },
    record: async (w, step, fn) => {
      if (w.before === null && step.keyword.trim() === 'When' && w.client) {
        w.before = {
          handles: w.client.handles(),
          snapshot: w.client.room.getSnapshot(),
        };
      }
      return await fn();
    },
  });
}
