import { assert } from '@pkgs/assert';

/** Platform fetch — not a system-owned port. */
export type Fetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type ResourceCtx = {
  readonly address: string;
  log: (...args: unknown[]) => void;
  clock: { now(): number };
  timers: {
    setTimeout: (fn: () => void, ms: number) => unknown;
    clearTimeout: (handle: unknown) => void;
    setInterval: (fn: () => void, ms: number) => unknown;
    clearInterval: (handle: unknown) => void;
  };
  random: () => number;
  createId: () => string;
  seed: bigint;
};

export type ImplFactory<
  Deps extends Record<string, unknown> = Record<string, unknown>,
  T = unknown,
> = (deps: Deps, ctx: ResourceCtx) => T | Promise<T>;

export type ResourceRef<T = unknown, Deps = unknown> = {
  readonly __resourceId: symbol;
  readonly __exposes: T;
  readonly __deps: Deps;
  readonly __keyed: boolean;
  implement: <Local = T>(
    factory: (
      deps: Deps extends Record<string, unknown> ? Deps : Record<string, never>,
      ctx: ResourceCtx
    ) => Local | Promise<Local>
  ) => ResourceImpl<T, Local>;
};

export type ResourceImpl<T = unknown, Local = T> = {
  readonly resource: ResourceRef<T, unknown>;
  readonly factory: ImplFactory<Record<string, unknown>, Local>;
};

export type Exposes<R> = R extends ResourceRef<infer T, unknown> ? T : never;

export type KeyedLookup<T> = (key: string) => T;

export type DepMap = Record<string, ResourceRef>;

type ResolvedDeps<D extends DepMap> = {
  [K in keyof D]: D[K]['__keyed'] extends true
    ? KeyedLookup<Exposes<D[K]>>
    : Exposes<D[K]>;
};

export type InternalResource = ResourceRef & {
  deps: DepMap | null;
  factory: ImplFactory<Record<string, unknown>, unknown> | null;
  keyedFlag: boolean;
};

type LeafFn<T> = ResourceRef<T, Record<string, never>> & {
  <D extends DepMap>(deps: D): ResourceRef<T, ResolvedDeps<D>>;
};

function bindImplement(self: InternalResource) {
  return function implement<Local>(
    factory: ImplFactory<Record<string, unknown>, Local>
  ): ResourceImpl<unknown, Local> {
    self.factory = factory;
    return { resource: self, factory };
  };
}

function createNode(): InternalResource {
  const node = {
    __resourceId: Symbol('resource'),
    __exposes: undefined as unknown,
    __deps: undefined as unknown,
    get __keyed() {
      return node.keyedFlag;
    },
    keyedFlag: false,
    deps: null as DepMap | null,
    factory: null as ImplFactory | null,
    implement: undefined as unknown as InternalResource['implement'],
  } as InternalResource;
  node.implement = bindImplement(node) as InternalResource['implement'];
  return node;
}

/**
 * `resource<T>()` — leaf resource.
 * `resource<T>()({ ...deps })` — depful resource (extra call required for TS).
 */
export function resource<T = never>(): LeafFn<T> {
  const state = createNode();

  function withDeps<D extends DepMap>(
    deps: D
  ): ResourceRef<T, ResolvedDeps<D>> {
    assert.ok(state.deps === null, 'resource deps already attached');
    const bound = createNode();
    bound.deps = deps;
    bound.keyedFlag = state.keyedFlag;
    return bound as unknown as ResourceRef<T, ResolvedDeps<D>>;
  }

  const leaf = withDeps as LeafFn<T>;
  Object.defineProperty(leaf, '__resourceId', {
    get: () => state.__resourceId,
    enumerable: true,
  });
  Object.defineProperty(leaf, '__exposes', {
    get: () => state.__exposes,
    enumerable: true,
  });
  Object.defineProperty(leaf, '__deps', {
    get: () => state.__deps,
    enumerable: true,
  });
  Object.defineProperty(leaf, '__keyed', {
    get: () => state.keyedFlag,
    enumerable: true,
  });
  Object.defineProperty(leaf, 'keyedFlag', {
    get: () => state.keyedFlag,
    set: (v: boolean) => {
      state.keyedFlag = v;
    },
  });
  Object.defineProperty(leaf, 'deps', {
    get: () => state.deps,
    set: (v: DepMap | null) => {
      state.deps = v;
    },
  });
  Object.defineProperty(leaf, 'factory', {
    get: () => state.factory,
    set: (v: ImplFactory | null) => {
      state.factory = v;
    },
  });
  leaf.implement = bindImplement(state) as LeafFn<T>['implement'];
  return leaf;
}

export function keyed<R extends ResourceRef>(
  r: R
): R & {
  readonly __keyed: true;
} {
  (r as unknown as InternalResource).keyedFlag = true;
  return r as R & { readonly __keyed: true };
}

export type SystemDefinition<
  Roots extends Record<string, ResourceRef> = Record<string, ResourceRef>,
> = {
  readonly roots: Roots;
  readonly addressOf: (resource: ResourceRef) => string | null;
  readonly resourceAt: (address: string) => ResourceRef | null;
};

function collectRefs(root: ResourceRef, into: Set<ResourceRef>): void {
  if (into.has(root)) return;
  into.add(root);
  const deps = (root as InternalResource).deps;
  if (!deps) return;
  for (const child of Object.values(deps)) collectRefs(child, into);
}

function countParents(
  roots: Record<string, ResourceRef>
): Map<ResourceRef, number> {
  const parentSets = new Map<ResourceRef, Set<ResourceRef>>();
  const walked = new Set<ResourceRef>();

  const walk = (r: ResourceRef, parent: ResourceRef | null) => {
    if (parent !== null) {
      let set = parentSets.get(r);
      if (!set) {
        set = new Set();
        parentSets.set(r, set);
      }
      set.add(parent);
    }
    if (walked.has(r)) return;
    walked.add(r);
    const deps = (r as InternalResource).deps;
    if (!deps) return;
    for (const child of Object.values(deps)) walk(child, r);
  };

  for (const r of Object.values(roots)) walk(r, null);

  const counts = new Map<ResourceRef, number>();
  for (const [ref, set] of parentSets) counts.set(ref, set.size);
  for (const r of Object.values(roots)) {
    if (!counts.has(r)) counts.set(r, 0);
  }
  return counts;
}

export function defineSystem<Roots extends Record<string, ResourceRef>>(
  roots: Roots
): SystemDefinition<Roots> {
  const named = new Map<ResourceRef, string>();
  for (const [name, ref] of Object.entries(roots)) {
    assert.ok(!named.has(ref), `defineSystem: resource '${name}' duplicated`);
    named.set(ref, name);
  }

  const parentCounts = countParents(roots);
  for (const [ref, count] of parentCounts) {
    if (count < 2) continue;
    if (named.has(ref)) continue;
    throw new Error(
      'defineSystem: shared resource must be named at the top level'
    );
  }

  const addressByResource = new Map<ResourceRef, string>();
  const resourceByAddress = new Map<string, ResourceRef>();

  const walk = (ref: ResourceRef, path: string) => {
    const top = named.get(ref);
    const address = top ?? path;
    if (!addressByResource.has(ref)) {
      addressByResource.set(ref, address);
      resourceByAddress.set(address, ref);
    }
    const deps = (ref as InternalResource).deps;
    if (!deps) return;
    for (const [key, child] of Object.entries(deps)) {
      const childTop = named.get(child);
      walk(child, childTop ?? `${address}.${key}`);
    }
  };

  for (const [name, ref] of Object.entries(roots)) walk(ref, name);

  return {
    roots,
    addressOf: (resource) => addressByResource.get(resource) ?? null,
    resourceAt: (address) => resourceByAddress.get(address) ?? null,
  };
}

/** Handler throw → 500 Response; only mesh faults become network TypeErrors. */
export function serveFetch(
  handler: (request: Request) => Response | Promise<Response>
): Fetch {
  return async (input, init) => {
    try {
      const request =
        input instanceof Request && init === undefined
          ? input
          : new Request(input, init);
      return await handler(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return new Response(message, { status: 500 });
    }
  };
}

export function getResourceDeps(resource: ResourceRef): DepMap | null {
  return (resource as InternalResource).deps;
}

export function getResourceFactory(
  resource: ResourceRef
): ImplFactory<Record<string, unknown>, unknown> | null {
  return (resource as InternalResource).factory;
}

export function collectAllResources(
  roots: Record<string, ResourceRef>
): Set<ResourceRef> {
  const into = new Set<ResourceRef>();
  for (const r of Object.values(roots)) collectRefs(r, into);
  return into;
}

export function isResourceKeyed(resource: ResourceRef): boolean {
  return (resource as InternalResource).keyedFlag === true;
}
