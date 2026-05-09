/**
 * Clojure-style kebab-case attribute key validation — re-exported from
 * `@gamezilla/lib/attribute` so callers can import from either package with
 * identical behavior.
 */
export {
  ATTRIBUTE_KEY_MAX_LENGTH,
  ATTRIBUTE_NAMESPACE_MAX_SEGMENTS,
  ATTRIBUTE_SEGMENT_MAX_LENGTH,
  ATTRIBUTE_SEGMENT_MIN_LENGTH,
  CLOJURE_KEBAB_SEGMENT,
  CLOJURE_NAMESPACED_ATTRIBUTE_REGEX,
  isClojureLocalName,
  isClojureNamespacedKey,
  isClojureNamespacePrefix,
} from '@gamezilla/lib/attribute';
