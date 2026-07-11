/**
 * DiceBear avatar persisted on the profile entity.
 *
 * `options` holds partial DiceBear style + core options (arrays for enums/colors, etc.).
 */

export const DEFAULT_AVATAR_STYLE = 'funEmoji';

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

const RANDOM_SEED_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Short alphanumeric seed for DiceBear randomize (not a UUID). */
export function generateRandomAvatarSeed(length = 12): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += RANDOM_SEED_CHARS[bytes[i]! % RANDOM_SEED_CHARS.length]!;
  }
  return out;
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

function avatarConfigFromObject(o: Record<string, unknown>): AvatarConfig {
  const seed = typeof o['seed'] === 'string' ? o['seed'] : '';
  return { style: pickStyle(o), seed, options: pickOptions(o) };
}

/**
 * Accepts either a JSON-encoded string (canonical wire form) or an already-
 * parsed `AvatarConfig`-shaped object. Idempotency matters because the
 * namespaced attribute helper runs the parser on write, so the stored
 * attribute can be the parsed object (not the original JSON string) on the
 * read side. `null` for shapes that don't look like an avatar config.
 */
export function parseAvatarConfig(raw: unknown): AvatarConfig | null {
  if (typeof raw === 'string') {
    const o = tryParseJsonObject(raw);
    return o === null ? null : avatarConfigFromObject(o);
  }
  if (isPlainObject(raw)) {
    return avatarConfigFromObject(raw);
  }
  return null;
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
