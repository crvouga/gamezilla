/**
 * Clojure-style kebab-case attribute key validation — re-exported from
 * `@gamezilla/lib/attribute` so callers can import from either package with
 * identical behavior.
 */
export {
  CLOJURE_KEBAB_SEGMENT,
  CLOJURE_NAMESPACED_ATTRIBUTE_REGEX,
  isClojureLocalName,
  isClojureNamespacedKey,
  isClojureNamespacePrefix,
} from '@gamezilla/lib/attribute';
