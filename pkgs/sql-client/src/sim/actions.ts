import { command } from '@pkgs/determinism';
import fc from 'fast-check';
import {
  corruptSimOpfsStore,
  fillSimOpfsPool,
} from '../sqlite/web/owners/sim-opfs-sql-owner';
import { persistImage } from './owners';
import { connectTab, disconnectTab, killTab } from './ownership';
import { readToyRow, writeToyRow } from './toy-kv';
import { boardOf, requireStore } from './types';

const KEYS = ['a', 'b', 'c'] as const;
const VALUES = ['1', '2', ''] as const;

type TabAction<K extends string> = {
  readonly kind: K;
  readonly tabId: string;
};

function arbTabId(
  ctx: import('@pkgs/determinism').CommandGeneratorContext
): fc.Arbitrary<string> {
  const tabs = ctx.nodeIds('tab');
  return tabs.length === 0 ? fc.constant('t0') : fc.constantFrom(...tabs);
}

function arbTabAction<K extends string>(
  kind: K,
  ctx: import('@pkgs/determinism').CommandGeneratorContext
): fc.Arbitrary<TabAction<K>> {
  return arbTabId(ctx).map((tabId) => ({ kind, tabId }));
}

type SqlWebWorld = import('@pkgs/determinism').World<
  Record<string, import('@pkgs/determinism').KnobDef>,
  Record<string, import('@pkgs/determinism').NodeEntry>
>;

export const connectAction = command<TabAction<'connect'>, object, SqlWebWorld>(
  {
    weight: 3,
    generate: (ctx) => arbTabAction('connect', ctx),
    apply: async (world, action) => {
      await connectTab(boardOf(world), action.tabId);
    },
  }
);

export const disconnectAction = command<
  TabAction<'disconnect'>,
  object,
  SqlWebWorld
>({
  weight: 3,
  generate: (ctx) => arbTabAction('disconnect', ctx),
  apply: async (world, action) => {
    await disconnectTab(boardOf(world), action.tabId);
  },
});

export type PutAction = {
  readonly kind: 'put';
  readonly tabId: string;
  readonly key: string;
  readonly value: string;
};

export const putAction = command<PutAction, object, SqlWebWorld>({
  weight: 3,
  generate: (ctx) =>
    fc.record({
      kind: fc.constant('put' as const),
      tabId: arbTabId(ctx),
      key: fc.constantFrom(...KEYS),
      value: fc.constantFrom(...VALUES),
    }),
  apply: async (world, action) => {
    const state = boardOf(world);
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

export const getAction = command<GetAction, object, SqlWebWorld>({
  weight: 3,
  generate: (ctx) =>
    fc.record({
      kind: fc.constant('get' as const),
      tabId: arbTabId(ctx),
      key: fc.constantFrom(...KEYS),
    }),
  apply: async (world, action) => {
    const state = boardOf(world);
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

export const killTabAction = command<TabAction<'killTab'>, object, SqlWebWorld>(
  {
    weight: 1,
    generate: (ctx) => arbTabAction('killTab', ctx),
    apply: async (world, action) => {
      await killTab(boardOf(world), action.tabId);
    },
  }
);

export const fillPoolAction = command<
  { readonly kind: 'fillPool' },
  object,
  SqlWebWorld
>({
  weight: 1,
  generate: () => fc.constant({ kind: 'fillPool' as const }),
  apply: async (world) => {
    fillSimOpfsPool(requireStore(boardOf(world)));
  },
});

export const corruptStoreAction = command<
  { readonly kind: 'corruptStore' },
  object,
  SqlWebWorld
>({
  weight: 1,
  generate: () => fc.constant({ kind: 'corruptStore' as const }),
  apply: async (world) => {
    corruptSimOpfsStore(requireStore(boardOf(world)));
  },
});

export const bumpEpochAction = command<
  { readonly kind: 'bumpEpoch' },
  object,
  SqlWebWorld
>({
  weight: 1,
  generate: () => fc.constant({ kind: 'bumpEpoch' as const }),
  apply: async (world) => {
    boardOf(world).epoch += 1;
  },
});

export const SQL_CLIENT_WEB_ACTIONS = {
  connect: connectAction,
  disconnect: disconnectAction,
  put: putAction,
  get: getAction,
  killTab: killTabAction,
  fillPool: fillPoolAction,
  corruptStore: corruptStoreAction,
  bumpEpoch: bumpEpochAction,
} as const;
