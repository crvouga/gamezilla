import { resolveSpaceFallbackTitleParts } from '../shared/resolve-space-fallback-title-parts';

type Translate = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => string;

/**
 * Pure formatter for tests / non-React callers.
 * Prefer {@link useSpaceDisplayTitle} in UI so Lingui macros extract strings.
 */
export function formatSpaceDisplayTitle(
  customTitle: string | null,
  hostUsername: string | null | undefined,
  spaceId: string,
  t: Translate
): string {
  if (customTitle !== null && customTitle.length > 0) {
    return customTitle;
  }
  const parts = resolveSpaceFallbackTitleParts(hostUsername, spaceId);
  if (parts.kind === 'host') {
    return t`${parts.hostName}'s space`;
  }
  return t`Space ${parts.suffix}`;
}
