import type { SeededRng } from '@pkgs/uuid-shared-ts/seeded-rng';

/** How a wire payload is mangled before delivery. */
export type HarnessCorruptionVariant =
  | 'truncatedJson'
  | 'garbageString'
  | 'flipField';

export function corruptJsonString(
  json: string,
  variant: HarnessCorruptionVariant
): string {
  switch (variant) {
    case 'truncatedJson':
      return json.slice(0, Math.max(1, Math.floor(json.length / 3)));
    case 'garbageString':
      return '__harness_corrupt__';
    case 'flipField':
      return json.replace(/"(body|title|checkpoint)":/g, '"$1_corrupt":');
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

export function corruptUnknownPayload(
  data: unknown,
  variant: HarnessCorruptionVariant,
  rng: SeededRng
): unknown {
  if (typeof data === 'string') {
    return corruptJsonString(data, variant);
  }
  try {
    const json = JSON.stringify(data);
    const corrupted = corruptJsonString(json, variant);
    try {
      return JSON.parse(corrupted) as unknown;
    } catch {
      return corrupted;
    }
  } catch {
    return rng.int(2) === 0 ? null : '__harness_corrupt__';
  }
}
