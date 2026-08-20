/** Merge or strip a page of keys from a controlled selection list. */
export function setPageKeysSelected(
  keys: readonly string[],
  pageKeys: readonly string[],
  selectAll: boolean
): readonly string[] {
  if (selectAll) {
    const next = new Set(keys);
    for (const key of pageKeys) {
      next.add(key);
    }
    return [...next];
  }
  const pageSet = new Set(pageKeys);
  return keys.filter((key) => !pageSet.has(key));
}

export function toggleSelectedKey(
  keys: readonly string[],
  key: string,
  selected: boolean
): readonly string[] {
  if (selected) {
    return keys.includes(key) ? keys : [...keys, key];
  }
  return keys.filter((k) => k !== key);
}

export function pageSelectionState(
  pageKeys: readonly string[],
  selectedKeys: readonly string[]
): { readonly all: boolean; readonly some: boolean } {
  if (pageKeys.length === 0) {
    return { all: false, some: false };
  }
  const selected = new Set(selectedKeys);
  let count = 0;
  for (const key of pageKeys) {
    if (selected.has(key)) count += 1;
  }
  return {
    all: count === pageKeys.length,
    some: count > 0 && count < pageKeys.length,
  };
}
