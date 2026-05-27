/**
 * HeroUI Native `Skeleton` adapter.
 *
 * Wraps HeroUI's `Skeleton` (`shimmer` variant by default) with explicit
 * width / height / border-radius forwarded via inline `style`. HeroUI's
 * built-in shimmer animation replaces our `expo-linear-gradient` sweep
 * loop; visual output should match closely once Uniwind's CSS variables
 * resolve our `surfaceMuted` / `surfaceElevated` tokens.
 */

import { Skeleton as HeroUISkeleton } from 'heroui-native';
import type { SkeletonProps } from '../../components/skeleton';

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 4,
}: SkeletonProps) {
  return (
    <HeroUISkeleton
      variant="shimmer"
      style={{ width, height, borderRadius }}
    />
  );
}
