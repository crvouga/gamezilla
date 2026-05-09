export {
  ATTRIBUTE_KEY_MAX_LENGTH,
  ATTRIBUTE_NAMESPACE_MAX_SEGMENTS,
  ATTRIBUTE_SEGMENT_MAX_LENGTH,
  ATTRIBUTE_SEGMENT_MIN_LENGTH,
  CLOJURE_KEBAB_SEGMENT,
  CLOJURE_NAMESPACED_ATTRIBUTE_REGEX,
  createAttrNamespace,
  isClojureLocalName,
  isClojureNamespacedKey,
  isClojureNamespacePrefix,
} from './attribute';
export type {
  AttributeNamespace,
  AttributeParser,
  AttributeState,
  AttributeTag,
  JoinDot,
} from './attribute';
