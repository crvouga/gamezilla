import { describe, expect, test } from 'bun:test';
import { Assert } from '../assert';
import { DependencyInjectionContainer } from './dependency-injection-container';
import type { InjectionToken } from './dependency-injection-container';
import {
  ComponentSystemBuilder,
  type ComponentRuntime,
  type Lifecycle,
} from './component-system';

const TokenA = Symbol('A') as InjectionToken<unknown>;
const TokenB = Symbol('B') as InjectionToken<unknown>;
const TokenC = Symbol('C') as InjectionToken<unknown>;
const TokenParent = Symbol('P') as InjectionToken<unknown>;

describe('ComponentSystemBuilder / StartedComponentSystem', () => {
  test('start order respects dependencies; stop is reverse', async () => {
    const order: string[] = [];
    const stops: string[] = [];

    class La implements Lifecycle {
      constructor(private readonly id: string) {}
      async start(): Promise<void> {
        order.push(this.id);
      }
      async stop(): Promise<void> {
        stops.push(this.id);
      }
    }

    const builder = new ComponentSystemBuilder();
    builder.register({
      token: TokenA,
      dependencies: [],
      create: () => new La('A'),
    });
    builder.register({
      token: TokenB,
      dependencies: [TokenA],
      create: () => new La('B'),
    });
    builder.register({
      token: TokenC,
      dependencies: [TokenB],
      create: () => new La('C'),
    });

    const sys = await builder.start();
    expect(order).toEqual(['A', 'B', 'C']);
    await sys.stop();
    expect(stops).toEqual(['C', 'B', 'A']);
  });

  test('cycle in declared dependencies throws at start', async () => {
    const builder = new ComponentSystemBuilder(undefined, Assert.validation());
    builder.register({
      token: TokenA,
      dependencies: [TokenB],
      create: () => 'a',
    });
    builder.register({
      token: TokenB,
      dependencies: [TokenA],
      create: () => 'b',
    });
    await expect(builder.start()).rejects.toThrow(/cycle/i);
  });

  test('parent fallback: resolve from parent; child stop does not touch parent', async () => {
    const parent = new DependencyInjectionContainer();
    parent.registerValue(TokenParent, 'from-parent');

    let parentStopped = false;
    class Parentish implements Lifecycle {
      async stop(): Promise<void> {
        parentStopped = true;
      }
    }
    parent.registerValue(TokenA, new Parentish());

    const order: string[] = [];
    const builder = new ComponentSystemBuilder(parent);
    builder.register({
      token: TokenB,
      dependencies: [TokenParent],
      create: (rt: ComponentRuntime) => {
        order.push(rt.get(TokenParent) as string);
        return 'b';
      },
    });

    const sys = await builder.start();
    expect(sys.get(TokenB)).toBe('b');
    expect(order).toEqual(['from-parent']);
    await sys.stop();
    expect(parentStopped).toBe(false);
  });

  test('replace stops dependents then restarts; new instance visible', async () => {
    const stops: string[] = [];
    let bVersion = 0;

    class Tracked implements Lifecycle {
      constructor(private readonly id: string) {}
      async stop(): Promise<void> {
        stops.push(this.id);
      }
    }

    class Bsvc implements Lifecycle {
      readonly v: number;
      constructor(v: number) {
        this.v = v;
      }
      async stop(): Promise<void> {
        stops.push(`B${this.v}`);
      }
    }

    class Csvc implements Lifecycle {
      constructor(readonly b: Bsvc) {}
      async stop(): Promise<void> {
        stops.push('C');
      }
    }

    const builder = new ComponentSystemBuilder();
    builder.register({
      token: TokenA,
      dependencies: [],
      create: () => new Tracked('A'),
    });
    builder.register({
      token: TokenB,
      dependencies: [TokenA],
      create: () => {
        bVersion++;
        return new Bsvc(bVersion);
      },
    });
    builder.register({
      token: TokenC,
      dependencies: [TokenB],
      create: (rt) => new Csvc(rt.get(TokenB) as Bsvc),
    });

    const sys = await builder.start();
    expect((sys.get(TokenB) as Bsvc).v).toBe(1);
    expect((sys.get(TokenC) as Csvc).b.v).toBe(1);

    stops.length = 0;
    await sys.replace({
      token: TokenB,
      dependencies: [TokenA],
      create: () => {
        bVersion++;
        return new Bsvc(bVersion);
      },
    });

    expect(stops).toEqual(['C', 'B1']);
    expect((sys.get(TokenB) as Bsvc).v).toBe(2);
    expect((sys.get(TokenC) as Csvc).b.v).toBe(2);
  });

  test('registerValue is zero-dep leaf', async () => {
    const builder = new ComponentSystemBuilder();
    builder.registerValue(TokenA, 'leaf');
    const sys = await builder.start();
    expect(sys.get(TokenA)).toBe('leaf');
    await sys.stop();
  });

  test('get throws after stop', async () => {
    const builder = new ComponentSystemBuilder(undefined, Assert.validation());
    builder.registerValue(TokenA, 'x');
    const sys = await builder.start();
    await sys.stop();
    expect(() => sys.get(TokenA)).toThrow();
  });
});
