/**
 * DiceBear avatar persisted on the device-local profile entity.
 *
 * `options` holds partial DiceBear style + core options (arrays for enums/colors, etc.).
 */

/** Legacy PatchDB attribute — migrated on read until user saves `avatarConfig`. */
export const LEGACY_PROFILE_AVATAR_SEED = 'profile/avatarSeed' as const;

export const DEFAULT_AVATAR_STYLE = 'lorelei';

export type AvatarConfig = {
  /** Style key matching `@dicebear/collection` export names (e.g. `lorelei`, `pixelArt`). */
  style: string;
  /** DiceBear seed; empty string means “use principal id” at render time. */
  seed: string;
  /** Partial options merged into `createAvatar(style, { ...options, seed })`. */
  options: Record<string, unknown>;
};

export function parseAvatarConfig(raw: unknown): AvatarConfig | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const o = parsed as Record<string, unknown>;
    const style =
      typeof o['style'] === 'string' && o['style'].length > 0
        ? o['style']
        : DEFAULT_AVATAR_STYLE;
    const seed = typeof o['seed'] === 'string' ? o['seed'] : '';
    const opt = o['options'];
    const options =
      opt !== null &&
      opt !== undefined &&
      typeof opt === 'object' &&
      !Array.isArray(opt)
        ? (opt as Record<string, unknown>)
        : {};
    return { style, seed, options };
  } catch {
    return null;
  }
}

export function serializeAvatarConfig(config: AvatarConfig): string {
  return JSON.stringify({
    style: config.style,
    seed: config.seed,
    options: sortKeysDeep(config.options),
  });
}

/** Effective seed for DiceBear (principal id when custom seed is empty). */
export function resolveAvatarSeed(config: AvatarConfig, principalId: string): string {
  const t = config.seed.trim();
  return t.length > 0 ? t : principalId;
}

export function resolveAvatarConfig(
  attributes: Record<string, unknown> | undefined,
  _principalId: string,
  avatarConfigAttr: string,
): AvatarConfig {
  const rawConfig = attributes?.[avatarConfigAttr];
  const parsed = parseAvatarConfig(rawConfig);
  if (parsed) {
    return parsed;
  }
  const legacy = attributes?.[LEGACY_PROFILE_AVATAR_SEED];
  if (typeof legacy === 'string' && legacy.trim().length > 0) {
    return {
      style: DEFAULT_AVATAR_STYLE,
      seed: legacy.trim(),
      options: {},
    };
  }
  return {
    style: DEFAULT_AVATAR_STYLE,
    seed: '',
    options: {},
  };
}

export function configsEqual(a: AvatarConfig, b: AvatarConfig): boolean {
  return serializeAvatarConfig(a) === serializeAvatarConfig(b);
}

function sortKeysDeep(obj: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = obj[k];
    out[k] =
      v !== null &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      !(v instanceof Date)
        ? sortKeysDeep(v as Record<string, unknown>)
        : v;
  }
  return out;
}
