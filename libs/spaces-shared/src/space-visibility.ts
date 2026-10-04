export const SPACE_VISIBILITIES = ['public', 'private'] as const;

export type SpaceVisibility = (typeof SPACE_VISIBILITIES)[number];

export function isSpaceVisibility(value: unknown): value is SpaceVisibility {
  return (
    typeof value === 'string' &&
    (SPACE_VISIBILITIES as readonly string[]).includes(value)
  );
}

export function parseSpaceVisibility(
  value: unknown,
  fallback: SpaceVisibility = 'private'
): SpaceVisibility {
  return isSpaceVisibility(value) ? value : fallback;
}
