/**
 * DiceBear avatar persisted on the profile entity.
 *
 * `options` holds partial DiceBear style + core options (arrays for enums/colors, etc.).
 */

export const DEFAULT_AVATAR_STYLE = 'lorelei';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export type AvatarConfig = {
  /** Style key matching `@dicebear/collection` export names (e.g. `lorelei`, `pixelArt`). */
  style: string;
  /**
   * DiceBear seed. Persisted profiles should use a non-empty value (typically
   * the profile `entityId`). Empty string is legacy / in-editor only; UI may
   * pass `identitySeedFallback` to `resolveAvatarSeed` until backfill runs.
   */
  seed: string;
  /** Partial options merged into `createAvatar(style, { ...options, seed })`. */
  options: Record<string, unknown>;
};

/** Deterministic default avatar for `entityId === profileEntityId`. */
export function createDefaultAvatarConfig(
  profileEntityId: string
): AvatarConfig {
  return {
    style: DEFAULT_AVATAR_STYLE,
    seed: profileEntityId,
    options: {},
  };
}

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function pickStyle(o: Record<string, unknown>): string {
  const v = o['style'];
  return typeof v === 'string' && v.length > 0 ? v : DEFAULT_AVATAR_STYLE;
}

function pickOptions(o: Record<string, unknown>): Record<string, unknown> {
  const opt = o['options'];
  if (isPlainObject(opt)) {
    return opt;
  }
  return {};
}

export function parseAvatarConfig(raw: unknown): AvatarConfig | null {
  if (typeof raw !== 'string') return null;
  const o = tryParseJsonObject(raw);
  if (o === null) return null;
  const seed = typeof o['seed'] === 'string' ? o['seed'] : '';
  return { style: pickStyle(o), seed, options: pickOptions(o) };
}

export function serializeAvatarConfig(config: AvatarConfig): string {
  return JSON.stringify({
    style: config.style,
    seed: config.seed,
    options: sortKeysDeep(config.options),
  });
}

export function serializeDefaultAvatarConfig(profileEntityId: string): string {
  return serializeAvatarConfig(createDefaultAvatarConfig(profileEntityId));
}

/**
 * Effective DiceBear seed: `config.seed` when non-empty, else `identitySeedFallback`
 * (use profile / host `entityId`, not an unrelated install id).
 */
export function resolveAvatarSeed(
  config: AvatarConfig,
  identitySeedFallback: string
): string {
  const t = config.seed.trim();
  return t.length > 0 ? t : identitySeedFallback;
}

export function configsEqual(a: AvatarConfig, b: AvatarConfig): boolean {
  return serializeAvatarConfig(a) === serializeAvatarConfig(b);
}

function sortKeysDeep(obj: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = obj[k];
    out[k] = isPlainObject(v) && !(v instanceof Date) ? sortKeysDeep(v) : v;
  }
  return out;
}
