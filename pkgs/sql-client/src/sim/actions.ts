import { type ActionGeneratorContext, actions, type World } from '@pkgs/dst';
import fc from 'fast-check';
import {
  corruptSimOpfsStore,
  fillSimOpfsPool,
} from '../sqlite/web/owners/sim-opfs-sql-owner';
import { persistImage } from './owners';
import { connectTab, disconnectTab, killTab } from './ownership';
import { readToyRow, writeToyRow } from './toy-kv';
import { boardOf, requireStore } from './types';

type SqlWebActionSurface = World;

const KEYS = ['a', 'b', 'c'] as const;
const VALUES = ['1', '2', ''] as const;

type TabAction<K extends string> = {
  readonly kind: K;
  readonly tabId: string;
};

function arbTabId(
  ctx: ActionGeneratorContext<SqlWebActionSurface>
): fc.Arbitrary<string> {
  const tabs = ctx.nodeIds('tab');
  return tabs.length === 0 ? fc.constant('t0') : fc.constantFrom(...tabs);
}

function arbTabAction<K extends string>(
  kind: K,
  ctx: ActionGeneratorContext<SqlWebActionSurface>
): fc.Arbitrary<TabAction<K>> {
  return arbTabId(ctx).map((tabId) => ({ kind, tabId }));
}

export type PutAction = {
  readonly kind: 'put';
  readonly tabId: string;
  readonly key: string;
  readonly value: string;
};

export type GetAction = {
  readonly kind: 'get';
  readonly tabId: string;
  readonly key: string;
};

export const SQL_CLIENT_WEB_ACTIONS = actions<SqlWebActionSurface>()({
  connect: {
    weight: 3,
    generate: (ctx) => arbTabAction('connect', ctx),
    apply: async (surface, payload) => {
      const action = payload as TabAction<'connect'>;
      await connectTab(boardOf(surface), action.tabId);
    },
  },
  disconnect: {
    weight: 3,
    generate: (ctx) => arbTabAction('disconnect', ctx),
    apply: async (surface, payload) => {
      const action = payload as TabAction<'disconnect'>;
      await disconnectTab(boardOf(surface), action.tabId);
    },
  },
  put: {
    weight: 3,
    generate: (ctx) =>
      fc.record({
        kind: fc.constant('put' as const),
        tabId: arbTabId(ctx),
        key: fc.constantFrom(...KEYS),
        value: fc.constantFrom(...VALUES),
      }),
    apply: async (surface, payload) => {
      const action = payload as PutAction;
      const state = boardOf(surface);
      const client = await connectTab(state, action.tabId);
      if (client === null) return;
      await writeToyRow(client, action.key, action.value);
      state.expected.set(action.key, action.value);
      persistImage(state, client);
    },
  },
  get: {
    weight: 3,
    generate: (ctx) =>
      fc.record({
        kind: fc.constant('get' as const),
        tabId: arbTabId(ctx),
        key: fc.constantFrom(...KEYS),
      }),
    apply: async (surface, payload) => {
      const action = payload as GetAction;
      const state = boardOf(surface);
      const client = await connectTab(state, action.tabId);
      if (client === null) return;
      const got = await readToyRow(client, action.key);
      const want = state.expected.get(action.key) ?? null;
      if (got !== want) {
        state.mismatches.push(
          `tab ${action.tabId} read ${action.key}=${String(got)} want ${String(want)}`
        );
      }
    },
  },
  killTab: {
    weight: 1,
    generate: (ctx) => arbTabAction('killTab', ctx),
    apply: async (surface, payload) => {
      const action = payload as TabAction<'killTab'>;
      await killTab(boardOf(surface), action.tabId);
    },
  },
  fillPool: {
    weight: 1,
    generate: () => fc.constant({ kind: 'fillPool' as const }),
    apply: async (surface) => {
      fillSimOpfsPool(requireStore(boardOf(surface)));
    },
  },
  corruptStore: {
    weight: 1,
    generate: () => fc.constant({ kind: 'corruptStore' as const }),
    apply: async (surface) => {
      corruptSimOpfsStore(requireStore(boardOf(surface)));
    },
  },
  bumpEpoch: {
    weight: 1,
    generate: () => fc.constant({ kind: 'bumpEpoch' as const }),
    apply: async (surface) => {
      boardOf(surface).epoch += 1;
    },
  },
});
