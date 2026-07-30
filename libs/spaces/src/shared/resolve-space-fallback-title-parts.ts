/**
 * Host possessive title vs generic label when username is missing/empty.
 * Never embed space ids in titles — callers apply i18n
 * (`${hostName}'s space` / `Space`).
 */
export type SpaceFallbackTitleParts =
  | { readonly kind: 'host'; readonly hostName: string }
  | { readonly kind: 'generic' };

export function resolveSpaceFallbackTitleParts(
  hostUsername: string | null | undefined
): SpaceFallbackTitleParts {
  const name = hostUsername ?? '';
  if (name.length > 0) {
    return { kind: 'host', hostName: name };
  }
  return { kind: 'generic' };
}
