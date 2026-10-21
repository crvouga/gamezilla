/**
 * Registry of UI explorer examples.
 *
 * A plain typed module: every `<name>.example.tsx` default export is listed
 * once (in a `registry-entries-*.ts` module) under a
 * stable kebab-case `id`. `ExplorerList` / `ExplorerDetail` read the registry
 * (or a caller-owned `entries` subset); there is no runtime registration —
 * apps that need extra entries pass their own `entries`.
 */

import type { CatalogItem } from '@pkgs/ui-root-shared-ts/catalog-item';
import type { ComponentEntry } from '@pkgs/ui-root-shared-ts/component-entry';
import { ADDITION_ENTRIES } from './registry-entries-additions';
import { CORE_ENTRIES } from './registry-entries-core';
import { DISPLAY_ENTRIES } from './registry-entries-display';
import { PRIMITIVE_ENTRIES } from './registry-entries-primitives';
import { SCREEN_ENTRIES } from './registry-entries-screens';

export type ComponentRegistry = Readonly<Record<string, ComponentEntry>>;

const ENTRIES: readonly ComponentEntry[] = [
  ...CORE_ENTRIES,
  ...PRIMITIVE_ENTRIES,
  ...DISPLAY_ENTRIES,
  ...SCREEN_ENTRIES,
  ...ADDITION_ENTRIES,
];

/** Built-in explorer entries keyed by `id`, in display order. */
export const componentRegistry: ComponentRegistry = Object.freeze(
  Object.fromEntries(ENTRIES.map((e) => [e.id, e]))
);

/** Entries of a registry in display (insertion) order. */
export function registryEntries(
  registry: ComponentRegistry
): readonly ComponentEntry[] {
  return Object.values(registry);
}

/** Unique groups in first-seen order. */
export function registryGroups(
  entries: readonly ComponentEntry[]
): readonly string[] {
  return [...new Set(entries.map((e) => e.group))];
}

/** Map entries onto `CatalogList` / `CatalogDetail` items. */
export function toCatalogItems(
  entries: readonly ComponentEntry[]
): CatalogItem[] {
  return entries.map((e) => ({ id: e.id, label: e.title, category: e.group }));
}
