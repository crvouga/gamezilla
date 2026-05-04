/**
 * Stuart Sierra-style **component system** for TypeScript: explicit dependency edges,
 * async `start` / `stop` in topological order, and `replace` that stops transitive
 * dependents then restarts the affected subgraph.
 *
 * Inspired by [stuartsierra/component](https://github.com/stuartsierra/component):
 * each registered component declares dependencies; the system materializes instances
 * in dependency order, calls optional `start` in that same order, and `stop` in reverse.
 * `replace` updates one token’s factory/spec, tears down dependents (reverse order),
 * rebuilds, and starts forward again — async-safe for SQLite, sync timers, etc.
 *
 * Parent {@link Container} is used only as a **resolution fallback** (e.g. config on a
 * root {@link DependencyInjectionContainer}); parent tokens are **not** started or
 * stopped by this system.
 *
 * @packageDocumentation
 */

import type { Assert } from '../assert';
import { assert } from '../assert';
import type {
  Container,
  InjectionToken,
} from './dependency-injection-container';
import { DependencyInjectionContainer } from './dependency-injection-container';

/** Resolved during `create` / `start`; `get` returns instances already built in this system or parent. */
export interface ComponentRuntime extends Container {
  readonly get: <T>(token: InjectionToken<T>) => T;
}

/** Optional lifecycle hooks on component instances (duck-typed). */
export interface Lifecycle {
  start?(runtime: ComponentRuntime): Promise<void> | void;
  stop?(): Promise<void> | void;
}

export type ComponentSpec<T = unknown> = {
  readonly token: InjectionToken<T>;
  /** Tokens that must exist before this component (in this system or `parent`). */
  readonly dependencies: readonly InjectionToken<unknown>[];
  readonly create: (runtime: ComponentRuntime) => T;
};

type TokenKey = symbol | string;

function tokenKey(token: InjectionToken<unknown>): TokenKey {
  return token as TokenKey;
}

function hasLifecycle(x: unknown): x is Lifecycle {
  if (x === null || typeof x !== 'object') return false;
  const s = (x as Lifecycle).start;
  const t = (x as Lifecycle).stop;
  return (
    (s === undefined || typeof s === 'function') &&
    (t === undefined || typeof t === 'function')
  );
}

async function invokeStart(
  instance: unknown,
  runtime: ComponentRuntime
): Promise<void> {
  if (!hasLifecycle(instance)) return;
  const fn = instance.start;
  if (typeof fn === 'function') {
    await Promise.resolve(fn.call(instance, runtime));
  }
}

async function invokeStop(instance: unknown): Promise<void> {
  if (!hasLifecycle(instance)) return;
  const fn = instance.stop;
  if (typeof fn === 'function') {
    await Promise.resolve(fn.call(instance));
  }
}

/** Topological order of system tokens: dependencies before dependents. */
function topologicalOrder(
  specs: ReadonlyMap<TokenKey, ComponentSpec<unknown>>
): InjectionToken<unknown>[] {
  const tokens = [...specs.keys()] as InjectionToken<unknown>[];
  const inSystem = new Set<TokenKey>(tokens.map((t) => tokenKey(t)));

  const inDegree = new Map<TokenKey, number>();
  const children = new Map<TokenKey, TokenKey[]>();

  for (const t of tokens) {
    const k = tokenKey(t);
    const spec = specs.get(k);
    assert.ok(spec !== undefined, 'topologicalOrder: missing spec');
    let deg = 0;
    for (const d of spec.dependencies) {
      const dk = tokenKey(d);
      if (inSystem.has(dk)) deg++;
    }
    inDegree.set(k, deg);
    if (!children.has(k)) children.set(k, []);
  }

  for (const t of tokens) {
    const k = tokenKey(t);
    const spec = specs.get(k);
    assert.ok(spec !== undefined, 'topologicalOrder: missing spec');
    for (const d of spec.dependencies) {
      const dk = tokenKey(d);
      if (inSystem.has(dk)) {
        const list = children.get(dk);
        assert.ok(list !== undefined, 'topologicalOrder: children');
        list.push(k);
      }
    }
  }

  const queue: TokenKey[] = [];
  for (const [k, deg] of inDegree) {
    if (deg === 0) queue.push(k);
  }

  const order: InjectionToken<unknown>[] = [];
  while (queue.length > 0) {
    const k = queue.shift();
    assert.ok(k !== undefined, 'topologicalOrder: queue');
    const specNode = specs.get(k);
    assert.ok(specNode !== undefined, 'topologicalOrder: spec');
    order.push(specNode.token);
    for (const ck of children.get(k) ?? []) {
      const next = (inDegree.get(ck) ?? 0) - 1;
      inDegree.set(ck, next);
      if (next === 0) queue.push(ck);
    }
  }

  if (order.length !== specs.size) {
    throw new Error('Component graph has a cycle (declared dependencies)');
  }

  return order;
}

/** Tokens that directly list `root` as a dependency (in-system edges only). */
function directDependents(
  specs: ReadonlyMap<TokenKey, ComponentSpec<unknown>>,
  root: InjectionToken<unknown>
): InjectionToken<unknown>[] {
  const rk = tokenKey(root);
  const out: InjectionToken<unknown>[] = [];
  for (const [, spec] of specs) {
    for (const d of spec.dependencies) {
      if (tokenKey(d) === rk) {
        out.push(spec.token);
        break;
      }
    }
  }
  return out;
}

/** `{root} ∪` all tokens that transitively depend on `root` (BFS on reverse edges). */
function transitiveDependentsIncludingRoot(
  specs: ReadonlyMap<TokenKey, ComponentSpec<unknown>>,
  root: InjectionToken<unknown>
): Set<TokenKey> {
  const out = new Set<TokenKey>([tokenKey(root)]);
  const queue = [...directDependents(specs, root)];
  while (queue.length > 0) {
    const u = queue.shift();
    assert.ok(u !== undefined, 'transitiveDependents');
    const uk = tokenKey(u);
    if (out.has(uk)) continue;
    out.add(uk);
    for (const v of directDependents(specs, u)) {
      queue.push(v);
    }
  }
  return out;
}

/**
 * Fluent registration; call {@link ComponentSystemBuilder.start} to obtain a
 * {@link StartedComponentSystem}.
 */
export class ComponentSystemBuilder {
  private readonly assertImpl: Assert;
  private readonly parent: Container | null;
  private readonly specs = new Map<TokenKey, ComponentSpec<unknown>>();

  constructor(parent?: Container, assertParam: Assert = assert) {
    this.parent = parent ?? null;
    this.assertImpl = assertParam;
  }

  /**
   * Registers a component. Duplicate tokens throw.
   * Cycle detection runs at {@link start}.
   */
  register<T>(spec: ComponentSpec<T>): this {
    const key = tokenKey(spec.token);
    this.assertImpl.ok(
      !this.specs.has(key),
      `ComponentSystemBuilder.register: token already registered: ${String(spec.token)}`
    );
    this.specs.set(key, spec as ComponentSpec<unknown>);
    return this;
  }

  /** Sugar: zero dependencies, fixed instance, no lifecycle. */
  registerValue<T>(token: InjectionToken<T>, value: T): this {
    return this.register({
      token,
      dependencies: [],
      create: () => value,
    });
  }

  /**
   * Validates dependencies, builds instances in topo order, calls `start` in that order.
   */
  async start(): Promise<StartedComponentSystem> {
    for (const [, spec] of this.specs) {
      for (const d of spec.dependencies) {
        const dk = tokenKey(d);
        const inSelf = this.specs.has(dk);
        const inParent = this.parent?.has(d) ?? false;
        this.assertImpl.ok(
          inSelf || inParent,
          `ComponentSystemBuilder.start: unresolved dependency ${String(d)} for ${String(spec.token)}`
        );
      }
    }

    const order = topologicalOrder(this.specs);
    const instances = new Map<TokenKey, unknown>();

    const runtime: ComponentRuntime = {
      get: <T>(t: InjectionToken<T>): T => {
        const k = tokenKey(t);
        if (instances.has(k)) {
          return instances.get(k) as T;
        }
        if (this.parent?.has(t)) {
          return this.parent.get(t);
        }
        this.assertImpl.fail(
          `ComponentRuntime.get: no instance for ${String(t)} (not started or not in parent)`
        );
      },
      has: (t: InjectionToken<unknown>): boolean =>
        instances.has(tokenKey(t)) || (this.parent?.has(t) ?? false),
    };

    for (const t of order) {
      const spec = this.specs.get(tokenKey(t));
      this.assertImpl.ok(spec !== undefined, 'start: spec');
      const instance = spec.create(runtime);
      instances.set(tokenKey(t), instance);
    }

    for (const t of order) {
      const instance = instances.get(tokenKey(t));
      await invokeStart(instance, runtime);
    }

    return new StartedComponentSystem({
      parent: this.parent,
      specs: new Map(this.specs),
      instances,
      startOrder: order,
      assertImpl: this.assertImpl,
    });
  }
}

type StartedComponentSystemArgs = {
  readonly parent: Container | null;
  /** Mutable copy for {@link StartedComponentSystem.replace}. */
  specs: Map<TokenKey, ComponentSpec<unknown>>;
  instances: Map<TokenKey, unknown>;
  startOrder: InjectionToken<unknown>[];
  readonly assertImpl: Assert;
};

/**
 * A started system: {@link get} / {@link has} match {@link Container}. Call
 * {@link stop} before discarding. Use {@link replace} to swap one component and
 * restart transitive dependents.
 */
export class StartedComponentSystem implements Container {
  private readonly parent: Container | null;
  private specs: Map<TokenKey, ComponentSpec<unknown>>;
  private instances: Map<TokenKey, unknown>;
  private startOrder: InjectionToken<unknown>[];
  private readonly assertImpl: Assert;
  private stopped = false;

  constructor(args: StartedComponentSystemArgs) {
    this.parent = args.parent;
    this.specs = args.specs;
    this.instances = args.instances;
    this.startOrder = args.startOrder;
    this.assertImpl = args.assertImpl;
  }

  has(token: InjectionToken<unknown>): boolean {
    this.assertNotStopped('has');
    const k = tokenKey(token);
    return this.instances.has(k) || (this.parent?.has(token) ?? false);
  }

  get<T>(token: InjectionToken<T>): T {
    this.assertNotStopped('get');
    const k = tokenKey(token);
    if (this.instances.has(k)) {
      return this.instances.get(k) as T;
    }
    if (this.parent?.has(token)) {
      return this.parent.get(token);
    }
    this.assertImpl.fail(`StartedComponentSystem.get: ${String(token)}`);
  }

  /**
   * Stops in reverse start order, then clears instances. Idempotent after first stop.
   */
  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    for (let i = this.startOrder.length - 1; i >= 0; i--) {
      const t = this.startOrder[i];
      assert.ok(t !== undefined, 'stop order');
      const inst = this.instances.get(tokenKey(t));
      await invokeStop(inst);
    }
    this.instances.clear();
  }

  /**
   * Replaces the spec for `spec.token`, stops affected instances (dependents first),
   * re-instantiates and starts the affected subgraph in topo order.
   */
  async replace<T>(spec: ComponentSpec<T>): Promise<void> {
    this.assertNotStopped('replace');
    const root = spec.token;
    const rk = tokenKey(root);
    this.assertImpl.ok(
      this.specs.has(rk),
      `StartedComponentSystem.replace: unknown token ${String(root)}`
    );

    for (const d of spec.dependencies) {
      const dk = tokenKey(d);
      const inSelf = this.specs.has(dk);
      const inParent = this.parent?.has(d) ?? false;
      this.assertImpl.ok(
        inSelf || inParent,
        `StartedComponentSystem.replace: unresolved dependency ${String(d)}`
      );
    }

    const affectedKeys = transitiveDependentsIncludingRoot(this.specs, root);
    const affectedOrder = this.startOrder.filter((t) =>
      affectedKeys.has(tokenKey(t))
    );

    const runtimePartial = this.createRuntime();

    for (let i = affectedOrder.length - 1; i >= 0; i--) {
      const t = affectedOrder[i];
      assert.ok(t !== undefined, 'replace stop');
      const inst = this.instances.get(tokenKey(t));
      await invokeStop(inst);
      this.instances.delete(tokenKey(t));
    }

    this.specs.set(rk, spec as ComponentSpec<unknown>);

    const subSpecs = new Map<TokenKey, ComponentSpec<unknown>>();
    for (const k of affectedKeys) {
      const s = this.specs.get(k);
      assert.ok(s !== undefined, 'replace subSpecs');
      subSpecs.set(k, s);
    }
    const localOrder = topologicalOrder(subSpecs);

    for (const t of localOrder) {
      const s = subSpecs.get(tokenKey(t));
      assert.ok(s !== undefined, 'replace create');
      const instance = s.create(runtimePartial);
      this.instances.set(tokenKey(t), instance);
    }

    for (const t of localOrder) {
      const instance = this.instances.get(tokenKey(t));
      await invokeStart(instance, runtimePartial);
    }

    this.startOrder = topologicalOrder(this.specs);
  }

  private assertNotStopped(op: string): void {
    this.assertImpl.ok(
      !this.stopped,
      `StartedComponentSystem.${op}: already stopped`
    );
  }

  private createRuntime(): ComponentRuntime {
    const self = this;
    return {
      get<T>(t: InjectionToken<T>): T {
        return self.get(t);
      },
      has(t: InjectionToken<unknown>): boolean {
        return self.has(t);
      },
    };
  }
}

/**
 * True for containers that can act as `parent` to {@link ComponentSystemBuilder}
 * and participate in app composition (legacy sync container or started component system).
 */
export function isComposableDiParent(
  c: unknown
): c is DependencyInjectionContainer | StartedComponentSystem {
  return (
    c instanceof DependencyInjectionContainer ||
    c instanceof StartedComponentSystem
  );
}
