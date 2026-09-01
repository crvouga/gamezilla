import { type ActionArbContext, defineAction } from '@pkgs/determinism';
import fc from 'fast-check';
import {
  corruptSimOpfsStore,
  fillSimOpfsPool,
} from '../sqlite/web/owners/sim-opfs-sql-owner';
import { persistImage } from './owners';
import { connectTab, disconnectTab, killTab } from './ownership';
import { readToyRow, writeToyRow } from './toy-kv';
import { requireStore, type SqlClientWebState } from './types';

const KEYS = ['a', 'b', 'c'] as const;
const VALUES = ['1', '2', ''] as const;

type TabAction<K extends string> = {
  readonly kind: K;
  readonly tabId: string;
};

function arbTabId(ctx: ActionArbContext): fc.Arbitrary<string> {
  const tabs = ctx.roleIds('tab');
  return tabs.length === 0 ? fc.constant('t0') : fc.constantFrom(...tabs);
}

function arbTabAction<K extends string>(
  kind: K,
  ctx: ActionArbContext
): fc.Arbitrary<TabAction<K>> {
  return arbTabId(ctx).map((tabId) => ({ kind, tabId }));
}

export const connectAction = defineAction<
  SqlClientWebState,
  TabAction<'connect'>
>({
  kind: 'connect',
  class: 'domain',
  arb: (ctx) => arbTabAction('connect', ctx),
  dispatch: async (world, action) => {
    await connectTab(world.state, action.tabId);
  },
});

export const disconnectAction = defineAction<
  SqlClientWebState,
  TabAction<'disconnect'>
>({
  kind: 'disconnect',
  class: 'domain',
  arb: (ctx) => arbTabAction('disconnect', ctx),
  dispatch: async (world, action) => {
    await disconnectTab(world.state, action.tabId);
  },
});

export type PutAction = {
  readonly kind: 'put';
  readonly tabId: string;
  readonly key: string;
  readonly value: string;
};

export const putAction = defineAction<SqlClientWebState, PutAction>({
  kind: 'put',
  class: 'domain',
  arb: (ctx) =>
    fc.record({
      kind: fc.constant('put' as const),
      tabId: arbTabId(ctx),
      key: fc.constantFrom(...KEYS),
      value: fc.constantFrom(...VALUES),
    }),
  dispatch: async (world, action) => {
    const state = world.state;
    const client = await connectTab(state, action.tabId);
    if (client === null) return;
    await writeToyRow(client, action.key, action.value);
    state.expected.set(action.key, action.value);
    persistImage(state, client);
  },
});

export type GetAction = {
  readonly kind: 'get';
  readonly tabId: string;
  readonly key: string;
};

export const getAction = defineAction<SqlClientWebState, GetAction>({
  kind: 'get',
  class: 'domain',
  arb: (ctx) =>
    fc.record({
      kind: fc.constant('get' as const),
      tabId: arbTabId(ctx),
      key: fc.constantFrom(...KEYS),
    }),
  dispatch: async (world, action) => {
    const state = world.state;
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
});

export const killTabAction = defineAction<
  SqlClientWebState,
  TabAction<'killTab'>
>({
  kind: 'killTab',
  class: 'library',
  arb: (ctx) => arbTabAction('killTab', ctx),
  dispatch: async (world, action) => {
    await killTab(world.state, action.tabId);
  },
});

export const fillPoolAction = defineAction<
  SqlClientWebState,
  { readonly kind: 'fillPool' }
>({
  kind: 'fillPool',
  class: 'library',
  arb: () => fc.constant({ kind: 'fillPool' as const }),
  dispatch: async (world) => {
    fillSimOpfsPool(requireStore(world.state));
  },
});

export const corruptStoreAction = defineAction<
  SqlClientWebState,
  { readonly kind: 'corruptStore' }
>({
  kind: 'corruptStore',
  class: 'library',
  arb: () => fc.constant({ kind: 'corruptStore' as const }),
  dispatch: async (world) => {
    corruptSimOpfsStore(requireStore(world.state));
  },
});

/** Takes effect on the next owner open, like a deployed schema bump. */
export const bumpEpochAction = defineAction<
  SqlClientWebState,
  { readonly kind: 'bumpEpoch' }
>({
  kind: 'bumpEpoch',
  class: 'library',
  arb: () => fc.constant({ kind: 'bumpEpoch' as const }),
  dispatch: async (world) => {
    world.state.epoch += 1;
  },
});

export const SQL_CLIENT_WEB_ACTIONS = [
  connectAction,
  disconnectAction,
  putAction,
  getAction,
  killTabAction,
  fillPoolAction,
  corruptStoreAction,
  bumpEpochAction,
];
