/**
 * Git object id as lowercase hex: short (≥7) or full SHA-1 (40).
 * Invariant: baked in at client build time via `EXPO_PUBLIC_COMMIT_HASH`.
 */
export const COMMIT_HASH_HEX_REGEX = /^[0-9a-f]{7,40}$/;
