import type { RuntimeDef } from './define-runtime';
import { isRuntimeDef } from './define-runtime';
import type { CatalogSnapshot } from './define-snapshot';
import { isSnapshot } from './define-snapshot';
import type { CatalogAction, CatalogProperty } from './effect';
import { isAction, isProperty } from './effect';
import type { SystemRegistry, SystemRuntimeEntry } from './registry';

function duplicateError(systemName: string, kind: string, name: string): Error {
  return new Error(
    `defineSystem('${systemName}'): duplicate ${kind} '${name}'`
  );
}

function collectRuntimes(
  systemName: string,
  runtimes: readonly RuntimeDef[]
): {
  runtimeEntries: SystemRuntimeEntry[];
  defaultRuntimeName: string;
} {
  if (runtimes.length === 0) {
    throw new Error(
      `defineSystem('${systemName}'): at least one runtime is required`
    );
  }
  const runtimeEntries: SystemRuntimeEntry[] = [];
  let defaultRuntimeName: string | undefined;
  const seen = new Set<string>();
  for (const runtimeDef of runtimes) {
    if (!isRuntimeDef(runtimeDef)) {
      throw new Error(
        `defineSystem('${systemName}'): runtimes must be RuntimeDef (from defineRuntime)`
      );
    }
    if (seen.has(runtimeDef.name)) {
      throw duplicateError(systemName, 'runtime', runtimeDef.name);
    }
    seen.add(runtimeDef.name);
    if (runtimeDef.default) {
      if (defaultRuntimeName !== undefined) {
        throw new Error(
          `defineSystem('${systemName}'): exactly one default runtime required (already '${defaultRuntimeName}')`
        );
      }
      defaultRuntimeName = runtimeDef.name;
    }
    runtimeEntries.push({
      name: runtimeDef.name,
      isDefault: runtimeDef.default,
      create: runtimeDef.create,
    });
  }
  if (defaultRuntimeName === undefined) {
    throw new Error(
      `defineSystem('${systemName}'): exactly one runtime must have default: true`
    );
  }
  return { runtimeEntries, defaultRuntimeName };
}

function collectNamed<T extends { readonly name: string }>(args: {
  systemName: string;
  kind: string;
  typeName: string;
  items: readonly T[] | undefined;
  isItem: (value: unknown) => boolean;
}): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const item of args.items ?? []) {
    if (!args.isItem(item)) {
      throw new Error(
        `defineSystem('${args.systemName}'): ${args.kind}s must be ${args.typeName}`
      );
    }
    if (seen.has(item.name)) {
      throw duplicateError(args.systemName, args.kind, item.name);
    }
    seen.add(item.name);
    out.push(item);
  }
  return out;
}

export function buildRegistry<S>(def: {
  readonly name: string;
  readonly runtimes: readonly RuntimeDef[];
  readonly actions?: readonly CatalogAction<S>[];
  readonly properties?: readonly CatalogProperty<S>[];
  readonly snapshots?: readonly CatalogSnapshot<S>[];
}): SystemRegistry<S> {
  const systemName = def.name;
  const { runtimeEntries, defaultRuntimeName } = collectRuntimes(
    systemName,
    def.runtimes
  );
  return {
    actions: collectNamed({
      systemName,
      kind: 'action',
      typeName: 'Action (from defineAction)',
      items: def.actions,
      isItem: isAction,
    }) as CatalogAction<S>[],
    properties: collectNamed({
      systemName,
      kind: 'property',
      typeName: 'Property (from defineProperty)',
      items: def.properties,
      isItem: isProperty,
    }) as CatalogProperty<S>[],
    snapshots: collectNamed({
      systemName,
      kind: 'snapshot',
      typeName: 'Snapshot (from defineSnapshot)',
      items: def.snapshots,
      isItem: isSnapshot,
    }) as CatalogSnapshot<S>[],
    runtimeEntries,
    defaultRuntimeName,
  };
}
