/** Identifier types. Plain string aliases; catalogs supply the literal unions. */
export type RoleId = string;
export type PermissionKey = string;
export type LimitKey = string;

/** Frozen, literal-typed map of namespaced identifier strings. */
export function defineCatalog<const T extends Record<string, string>>(
  entries: T
): Readonly<T> {
  return Object.freeze({ ...entries });
}

/** The value union of a {@link defineCatalog} result. */
export type CatalogValue<T extends Record<string, string>> = T[keyof T];
