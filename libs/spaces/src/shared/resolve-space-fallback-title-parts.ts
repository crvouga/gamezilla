export const SPACE_ID_TITLE_SUFFIX_LENGTH = 8;

export type SpaceFallbackTitleParts =
  | { readonly kind: 'host'; readonly hostName: string }
  | { readonly kind: 'id'; readonly suffix: string };

/**
 * Host possessive title vs id-suffix fallback when username is missing/empty.
 * Callers apply i18n (`${hostName}'s space` / `Space ${suffix}`).
 */
export function resolveSpaceFallbackTitleParts(
  hostUsername: string | null | undefined,
  spaceId: string
): SpaceFallbackTitleParts {
  const name = hostUsername ?? '';
  if (name.length > 0) {
    return { kind: 'host', hostName: name };
  }
  return {
    kind: 'id',
    suffix: spaceId.slice(-SPACE_ID_TITLE_SUFFIX_LENGTH),
  };
}
