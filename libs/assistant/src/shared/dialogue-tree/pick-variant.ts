import type { DialogueContext, DialogueLookupKey } from './types';

export type DialogueRng = {
  nextU01(): number;
};

function lookupDedupeKey(key: DialogueLookupKey): string {
  const theme = key.theme ?? '';
  const variation = key.variation ?? '';
  return `${key.bucket}\0${theme}\0${variation}`;
}

function substitutePlaceholders(text: string, ctx: DialogueContext): string {
  return text.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = ctx[name];
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  });
}

/**
 * Picks a variant index with rotation + dedupe so consecutive picks for the
 * same lookup key do not repeat the previous variant.
 */
export function pickDialogueVariantIndex(args: {
  readonly variantCount: number;
  readonly lookupKey: DialogueLookupKey;
  readonly rng: DialogueRng;
  readonly lastIndexByKey: Map<string, number>;
}): number {
  const { variantCount, lookupKey, rng, lastIndexByKey } = args;
  if (variantCount <= 0) {
    return -1;
  }
  if (variantCount === 1) {
    return 0;
  }
  const dedupeKey = lookupDedupeKey(lookupKey);
  const last = lastIndexByKey.get(dedupeKey);
  let idx = Math.floor(rng.nextU01() * variantCount);
  if (last !== undefined && idx === last) {
    idx =
      (idx + 1 + Math.floor(rng.nextU01() * (variantCount - 1))) % variantCount;
  }
  lastIndexByKey.set(dedupeKey, idx);
  return idx;
}

export function pickDialogueVariant(args: {
  readonly variants: readonly string[];
  readonly lookupKey: DialogueLookupKey;
  readonly ctx: DialogueContext;
  readonly rng: DialogueRng;
  readonly lastIndexByKey: Map<string, number>;
}): string | null {
  const idx = pickDialogueVariantIndex({
    variantCount: args.variants.length,
    lookupKey: args.lookupKey,
    rng: args.rng,
    lastIndexByKey: args.lastIndexByKey,
  });
  if (idx < 0) {
    return null;
  }
  const raw = args.variants[idx];
  if (raw === undefined) {
    return null;
  }
  return substitutePlaceholders(raw, args.ctx);
}

export function substituteDialogueText(
  text: string,
  ctx: DialogueContext
): string {
  return substitutePlaceholders(text, ctx);
}
