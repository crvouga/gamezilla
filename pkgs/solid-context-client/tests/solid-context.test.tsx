/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { defineContext } from '@pkgs/solid-context-client/define-context';
import { createSubscriptionSignal } from '@pkgs/solid-context-client/subscription-signal';
import { render, screen } from '@solidjs/testing-library';
import { createRoot } from 'solid-js';

type Greeter = { readonly greet: (name: string) => string };

const GreeterContext = defineContext<Greeter>('Greeter');

function Greeting(props: { readonly name: string }) {
  const greeter = GreeterContext.use();
  return <p data-testid="greeting">{greeter.greet(props.name)}</p>;
}

describe('defineContext', () => {
  test('provides the value to descendants', () => {
    render(() => (
      <GreeterContext.Provider value={{ greet: (n) => `hi ${n}` }}>
        <Greeting name="ada" />
      </GreeterContext.Provider>
    ));
    expect(screen.getByTestId('greeting')).toHaveTextContent('hi ada');
  });

  test('use() throws a named error without a provider', () => {
    expect(() => render(() => <Greeting name="x" />)).toThrow(
      'Greeter: provider missing — wrap the tree with GreeterProvider'
    );
  });

  test('useOptional() returns undefined without a provider', () => {
    let seen: Greeter | undefined = { greet: () => 'sentinel' };
    createRoot((dispose) => {
      seen = GreeterContext.useOptional();
      dispose();
    });
    expect(seen).toBeUndefined();
  });
});

describe('createSubscriptionSignal', () => {
  test('tracks external snapshots and unsubscribes on dispose', () => {
    let snapshot = 1;
    const listeners = new Set<() => void>();
    const source = {
      getSnapshot: () => snapshot,
      subscribe: (l: () => void) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
    };
    const emit = (next: number) => {
      snapshot = next;
      for (const l of listeners) l();
    };

    let value: (() => number) | undefined;
    const dispose = createRoot((d) => {
      value = createSubscriptionSignal(source);
      return d;
    });
    expect(value?.()).toBe(1);
    emit(2);
    expect(value?.()).toBe(2);
    expect(listeners.size).toBe(1);
    dispose();
    expect(listeners.size).toBe(0);
  });
});
