/**
 * How a package feeds a structure model its persisted state: one binding per
 * `.als` spec, naming each adapter (`server database`, `device database`)
 * and how it projects stored rows into snapshots. Module-global, filled by
 * the `tests/structure/*.binding.ts` modules a package's structure entry
 * (`tests/structure/index.ts`) imports.
 */

import type { Snapshot } from './snapshot';

export type StructureBinding = {
  /** The spec this binds: its `.als` file's stem (`spaces`). */
  readonly spec: string;
  /**
   * Adapter → the snapshots it reads back from a store the product wrote
   * (after seeded scenarios, say). Every adapter must yield at least one.
   */
  readonly snapshots: Readonly<
    Record<string, () => Promise<readonly Snapshot[]>>
  >;
};

type Registry = { readonly bindings: Map<string, StructureBinding> };

const REGISTRY_KEY = Symbol.for('alloy.registry');

function registry(): Registry {
  const host = globalThis as { [REGISTRY_KEY]?: Registry };
  host[REGISTRY_KEY] ??= { bindings: new Map() };
  return host[REGISTRY_KEY];
}

export function bindStructure(binding: StructureBinding): void {
  const bindings = registry().bindings;
  if (bindings.has(binding.spec)) {
    throw new Error(`alloy: structure spec ${binding.spec} is bound twice`);
  }
  bindings.set(binding.spec, binding);
}

export function structureBinding(spec: string): StructureBinding {
  const binding = registry().bindings.get(spec);
  if (binding === undefined) {
    throw new Error(
      `alloy: structure spec ${spec} has no binding — add bindStructure({ spec: '${spec}', snapshots: { … } }) in tests/structure/${spec}.binding.ts and import it from tests/structure/index.ts`
    );
  }
  return binding;
}
