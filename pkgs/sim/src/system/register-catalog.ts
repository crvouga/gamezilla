import type {
  CatalogSnapshot,
  Snapshot,
  SnapshotDef,
} from '../report/define-snapshot';
import { defineSnapshot, isSnapshot } from '../report/define-snapshot';
import { defineAction } from './define-action';
import { defineProperty } from './define-property';
import {
  type Action,
  type ActionDef,
  type CatalogAction,
  type CatalogProperty,
  isAction,
  isProperty,
  type Property,
  type PropertyDef,
} from './effect';
import type { RuntimeDef, SystemRegistry } from './registry';

export function registerRuntime(
  registry: SystemRegistry<unknown>,
  systemName: string,
  runtimes: string[],
  runtimeDef: RuntimeDef
): void {
  if (!runtimeDef.name) throw new Error('system.runtime: name is required');
  if (registry.runtimeEntries.some((h) => h.name === runtimeDef.name)) {
    throw new Error(
      `system.runtime: duplicate runtime '${runtimeDef.name}' on '${systemName}'`
    );
  }
  if (runtimeDef.default === true) {
    if (registry.defaultRuntimeName !== undefined) {
      throw new Error(
        `system.runtime: second default runtime on '${systemName}' (already '${registry.defaultRuntimeName}')`
      );
    }
    registry.defaultRuntimeName = runtimeDef.name;
  }
  registry.runtimeEntries.push({
    name: runtimeDef.name,
    isDefault: runtimeDef.default === true,
    create: runtimeDef.create,
  });
  runtimes.push(runtimeDef.name);
}

export function registerAction<S, const A extends unknown[]>(
  registry: SystemRegistry<S>,
  systemName: string,
  actionDef: ActionDef<S, A> | Action<S, A>
): Action<S, A> {
  const action = isAction(actionDef)
    ? (actionDef as Action<S, A>)
    : defineAction(actionDef as ActionDef<S, A>);
  if (registry.actions.some((a) => a.name === action.name)) {
    throw new Error(
      `system.action: duplicate action '${action.name}' on '${systemName}'`
    );
  }
  registry.actions.push(action as unknown as CatalogAction<S>);
  return action;
}

export function registerProperty<S, C = unknown>(
  registry: SystemRegistry<S>,
  systemName: string,
  propertyDef: PropertyDef<S, C> | Property<S, C>
): Property<S, C> {
  const property = isProperty(propertyDef)
    ? (propertyDef as Property<S, C>)
    : defineProperty(propertyDef as PropertyDef<S, C>);
  if (registry.properties.some((p) => p.name === property.name)) {
    throw new Error(
      `system.property: duplicate property '${property.name}' on '${systemName}'`
    );
  }
  registry.properties.push(property as unknown as CatalogProperty<S>);
  return property;
}

export function registerSnapshot<S, T = unknown>(
  registry: SystemRegistry<S>,
  systemName: string,
  snapshotDef: SnapshotDef<S, T> | Snapshot<S, T>
): Snapshot<S, T> {
  const snapshot = isSnapshot(snapshotDef)
    ? (snapshotDef as Snapshot<S, T>)
    : defineSnapshot(snapshotDef as SnapshotDef<S, T>);
  if (registry.snapshots.some((s) => s.name === snapshot.name)) {
    throw new Error(
      `system.snapshot: duplicate snapshot '${snapshot.name}' on '${systemName}'`
    );
  }
  registry.snapshots.push(snapshot as unknown as CatalogSnapshot<S>);
  return snapshot;
}
