/**
 * Agnostic catalog item — used by {@link CatalogList} / {@link CatalogDetail}.
 *
 * Callers own ordering; prev/next and list grouping follow the same
 * category-grouped flatten of this array.
 */

export type CatalogItem = {
  id: string;
  label: string;
  category?: string | undefined;
};

export type CatalogGroup = {
  category: string | null;
  items: readonly CatalogItem[];
};

/** Case-insensitive filter on `label` + `category`. */
export function filterCatalogItems(
  items: readonly CatalogItem[],
  query: string
): CatalogItem[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [...items];
  return items.filter((item) => matchesQuery(item, q));
}

function matchesQuery(item: CatalogItem, q: string): boolean {
  if (item.label.toLowerCase().includes(q)) return true;
  return item.category?.toLowerCase().includes(q) ?? false;
}

/**
 * Group by first-seen category order. Items without `category` land in a
 * trailing ungrouped section (`category: null`).
 */
export function groupCatalogItems(
  items: readonly CatalogItem[]
): CatalogGroup[] {
  const categories: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (item.category === undefined) continue;
    if (seen.has(item.category)) continue;
    seen.add(item.category);
    categories.push(item.category);
  }

  const groups: CatalogGroup[] = categories.map((category) => ({
    category,
    items: items.filter((i) => i.category === category),
  }));

  const uncategorized = items.filter((i) => i.category === undefined);
  if (uncategorized.length > 0) {
    groups.push({ category: null, items: uncategorized });
  }
  return groups;
}

/** Flatten in the same order {@link groupCatalogItems} / the list renders. */
export function flattenCatalogItems(
  items: readonly CatalogItem[]
): CatalogItem[] {
  return groupCatalogItems(items).flatMap((g) => [...g.items]);
}

export type CatalogNeighbor = {
  index: number;
  total: number;
  prev: CatalogItem | null;
  next: CatalogItem | null;
  current: CatalogItem | null;
};

/** Resolve prev/next neighbors for `currentId` in flattened catalog order. */
export function resolveCatalogNeighbor(
  items: readonly CatalogItem[],
  currentId: string
): CatalogNeighbor {
  const flat = flattenCatalogItems(items);
  const index = flat.findIndex((i) => i.id === currentId);
  if (index < 0) {
    return {
      index: -1,
      total: flat.length,
      prev: null,
      next: null,
      current: null,
    };
  }
  return {
    index,
    total: flat.length,
    prev: index > 0 ? (flat[index - 1] ?? null) : null,
    next: index < flat.length - 1 ? (flat[index + 1] ?? null) : null,
    current: flat[index] ?? null,
  };
}
