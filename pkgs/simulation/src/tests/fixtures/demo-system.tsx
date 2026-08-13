/**
 * Tiny in-memory SimulationSystem for package self-tests.
 * Shared toy state + per-actor React roots — no product, no sync-engine.
 */

import { createElement, type ReactElement, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';

import type {
  InProcessSimulationSession,
  LiveNodeAdapter,
  SimulationStartContext,
  SimulationSystem,
  SimulationSystemHandle,
} from '../../system-port';
import { defineTopology } from '../../topology';

type DemoStore = {
  title: string;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => string;
  setTitle: (title: string) => void;
};

function createDemoStore(): DemoStore {
  let title = '(empty)';
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const l of listeners) l();
  };
  return {
    get title() {
      return title;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => title,
    setTitle(next) {
      title = next;
      emit();
    },
  };
}

function DemoApp(props: {
  readonly actorId: string;
  readonly store: DemoStore;
}): ReactElement {
  const title = useSyncExternalStore(
    props.store.subscribe,
    props.store.getSnapshot,
    props.store.getSnapshot
  );
  return createElement(
    View,
    { testID: 'demo-root' },
    createElement(Text, { testID: 'actor-id' }, props.actorId),
    createElement(Text, { testID: 'shared-title' }, title),
    createElement(
      Pressable,
      {
        testID: 'create',
        accessibilityRole: 'button',
        accessibilityLabel: 'Create',
        onPress: () => {
          props.store.setTitle(`Game night (${props.actorId})`);
        },
      },
      createElement(Text, null, 'Create')
    )
  );
}

export const demoTopology = defineTopology({
  kinds: {
    client: { attributes: ['html', 'ingress', 'egress'] },
    server: { attributes: ['ingress', 'egress'] },
  },
  nodes: [{ id: 'server', kind: 'server' }],
  edges: [],
  spawn: {
    client: {
      edges: [{ to: 'server', kind: 'http' }],
    },
  },
});

/** In-process demo system with a shared title string across actors. */
export class DemoSimulationSystem implements SimulationSystem {
  readonly topology = demoTopology;

  async start(ctx: SimulationStartContext): Promise<SimulationSystemHandle> {
    if (ctx.ui !== 'in-process') {
      throw new Error('demo system only supports ui: in-process');
    }
    void ctx.io;
    const store = createDemoStore();
    const adapters = new Map<string, LiveNodeAdapter>();

    return {
      async spawn(node) {
        const existing = adapters.get(node.id);
        if (existing) return existing;

        if (node.kind === 'server') {
          const adapter: LiveNodeAdapter = {
            snapshot: async () => null,
            crash: async () => undefined,
            restart: async () => undefined,
            dispose: async () => {
              adapters.delete(node.id);
            },
          };
          adapters.set(node.id, adapter);
          return adapter;
        }

        if (node.kind !== 'client') {
          throw new Error(`DemoSimulationSystem: unknown kind ${node.kind}`);
        }

        const session: InProcessSimulationSession = {
          ui: 'in-process',
          harness: {
            createRoot: () =>
              createElement(DemoApp, { actorId: node.id, store }),
          },
          async dispose() {
            /* session closed by actor */
          },
        };
        let crashed = false;
        const adapter: LiveNodeAdapter = {
          session,
          snapshot: async (attr) => {
            if (attr === 'html') return null;
            return null;
          },
          async crash() {
            crashed = true;
          },
          async restart() {
            crashed = false;
          },
          async dispose() {
            adapters.delete(node.id);
            await session.dispose();
          },
        };
        void crashed;
        adapters.set(node.id, adapter);
        return adapter;
      },
      async dispose() {
        for (const a of [...adapters.values()]) {
          await a.dispose();
        }
        adapters.clear();
      },
    };
  }
}
