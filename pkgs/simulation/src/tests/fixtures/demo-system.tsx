/**
 * Tiny in-memory SimulationSystem for package self-tests.
 * Shared toy state + per-actor React roots — no product, no sync-engine.
 */

import { createElement, type ReactElement, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';

import type {
  InProcessSimulationSession,
  SimulationStartContext,
  SimulationSystem,
  SimulationSystemHandle,
} from '../../system-port';

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

/** In-process demo system with a shared title string across actors. */
export class DemoSimulationSystem implements SimulationSystem {
  async start(ctx: SimulationStartContext): Promise<SimulationSystemHandle> {
    if (ctx.ui !== 'in-process') {
      throw new Error('demo system only supports ui: in-process');
    }
    void ctx.io;
    const store = createDemoStore();
    const sessions = new Set<InProcessSimulationSession>();

    return {
      async createSession(actorId: string) {
        const session: InProcessSimulationSession = {
          ui: 'in-process',
          harness: {
            createRoot: () => createElement(DemoApp, { actorId, store }),
          },
          async dispose() {
            sessions.delete(session);
          },
        };
        sessions.add(session);
        return session;
      },
      async dispose() {
        for (const s of [...sessions]) {
          await s.dispose();
        }
        sessions.clear();
      },
    };
  }
}
