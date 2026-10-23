import type {
  DialogueContext,
  DialogueLookupKey,
  DialogueNode,
  DialogueStep,
  DialogueTree,
} from './types';

export type DialogueTreeThemeSpec =
  | readonly string[]
  | { readonly kind: 'single'; readonly variants: readonly string[] }
  | { readonly kind: 'sequence'; readonly steps: readonly DialogueStep[] };

export type DialogueTreeBucketSpec = Readonly<
  Record<string, DialogueTreeThemeSpec>
> & {
  readonly __default__?: DialogueTreeThemeSpec;
};

export type DialogueTreeSpec = Readonly<Record<string, DialogueTreeBucketSpec>>;

function isVariantList(spec: DialogueTreeThemeSpec): spec is readonly string[] {
  return Array.isArray(spec);
}

function normalizeThemeSpec(spec: DialogueTreeThemeSpec): DialogueNode {
  if (isVariantList(spec)) {
    return { kind: 'single', variants: spec };
  }
  if (spec.kind === 'single') {
    return { kind: 'single', variants: spec.variants };
  }
  return { kind: 'sequence', steps: spec.steps };
}

function resolveNode(
  bucketSpec: DialogueTreeBucketSpec,
  theme: string | undefined
): DialogueNode | null {
  if (theme !== undefined) {
    const themed = bucketSpec[theme];
    if (themed !== undefined) {
      return normalizeThemeSpec(themed);
    }
  }
  const fallback = bucketSpec.__default__;
  if (fallback === undefined) {
    return null;
  }
  return normalizeThemeSpec(fallback);
}

/**
 * Builds a {@link DialogueTree} from a record-based DSL:
 * bucket -> theme -> variants or sequence steps, with optional `__default__`.
 *
 * Coach line strings should use plain ASCII punctuation (`.`, `,`, `-`) so
 * TTS reads them reliably; avoid em dashes and other typographic Unicode.
 */
export function defineDialogueTree(spec: DialogueTreeSpec): DialogueTree {
  return {
    lookup(key: DialogueLookupKey, _ctx: DialogueContext): DialogueNode | null {
      const bucketSpec = spec[key.bucket];
      if (bucketSpec === undefined) {
        return null;
      }
      return resolveNode(bucketSpec, key.theme);
    },
  };
}
