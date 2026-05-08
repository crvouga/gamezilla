/**
 * PatchDB attribute key validation (namespaced string keys only).
 * Duplicates the rule in `@gamezilla/lib/attribute` so this package stays free of that dependency.
 */
export const PATCH_DB_NAMESPACED_ATTRIBUTE_REGEX =
  /^(?!.*\s)[a-zA-Z_][a-zA-Z0-9_.]*\/[a-zA-Z_][a-zA-Z0-9_.]*$/;

/** Returns true when `key` is a valid PatchDB attribute key string. */
export function isValidPatchDbAttributeKey(key: unknown): key is string {
  return (
    typeof key === 'string' && PATCH_DB_NAMESPACED_ATTRIBUTE_REGEX.test(key)
  );
}
