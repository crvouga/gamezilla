/**
 * `AvatarGroup` — horizontally stacked avatars with overlap (e.g. presence strip).
 */

import type { ReactElement, ReactNode } from 'react';
import { Children, isValidElement } from 'react';

import { useTheme } from '../../theme';
import { Box } from '../box';
import { Pressable } from '../pressable';
import { Text } from '../text';

export type AvatarGroupProps = {
  /** Avatar diameter in px; used for slot size and default overlap. */
  size?: number;
  /** Horizontal overlap in px; defaults to ~40% of `size`. */
  overlap?: number;
  /** Max avatars before showing an overflow pill. Omit for no limit. */
  maxVisible?: number;
  /** Border between stacked faces. Defaults to `2`. */
  ringBorderWidth?: number;
  /** Theme color token or raw color for the ring. Defaults to `'surface'`. */
  ringColor?: string;
  /** Custom overflow node; default is `+N` in a matching circle. */
  renderOverflow?: (hiddenCount: number) => ReactNode;
  children: ReactNode;
  onPress?: () => void;
};

function collectElements(children: ReactNode): ReactElement[] {
  return Children.toArray(children).filter(isValidElement) as ReactElement[];
}

function DefaultOverflowPill({
  count,
  size,
  ringBorderWidth,
  ringColorResolved,
}: {
  count: number;
  size: number;
  ringBorderWidth: number;
  ringColorResolved: string;
}) {
  return (
    <Box
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: ringBorderWidth,
        borderColor: ringColorResolved,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
      sx={{ background: 'outline' }}
    >
      <Text variant="caption" label={`+${String(count)}`} sx={{ color: 'text' }} />
    </Box>
  );
}

type SlotListProps = {
  visibleItems: ReactElement[];
  size: number;
  overlap: number;
  ringBorderWidth: number;
  ringColorResolved: string;
};

function AvatarGroupSlotList({
  visibleItems,
  size,
  overlap,
  ringBorderWidth,
  ringColorResolved,
}: SlotListProps) {
  return (
    <>
      {visibleItems.map((child, index) => (
        <Box
          key={`avatar-group-slot-${String(index)}`}
          style={{
            marginLeft: index === 0 ? 0 : -overlap,
            zIndex: index + 1,
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: ringBorderWidth,
            borderColor: ringColorResolved,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {child}
        </Box>
      ))}
    </>
  );
}

type OverflowProps = {
  hiddenCount: number;
  visibleCount: number;
  overlap: number;
  size: number;
  ringBorderWidth: number;
  ringColorResolved: string;
  renderOverflow?: (hiddenCount: number) => ReactNode;
};

function AvatarGroupOverflow({
  hiddenCount,
  visibleCount,
  overlap,
  size,
  ringBorderWidth,
  ringColorResolved,
  renderOverflow,
}: OverflowProps) {
  if (hiddenCount <= 0) {
    return null;
  }

  const body =
    typeof renderOverflow === 'function' ? (
      renderOverflow(hiddenCount)
    ) : (
      <DefaultOverflowPill
        count={hiddenCount}
        size={size}
        ringBorderWidth={ringBorderWidth}
        ringColorResolved={ringColorResolved}
      />
    );

  return (
    <Box
      style={{
        marginLeft: visibleCount === 0 ? 0 : -overlap,
        zIndex: visibleCount + 2,
      }}
    >
      {body}
    </Box>
  );
}

export function AvatarGroup({
  size = 40,
  overlap: overlapProp,
  maxVisible,
  ringBorderWidth = 2,
  ringColor = 'surface',
  renderOverflow,
  children,
  onPress,
}: AvatarGroupProps) {
  const theme = useTheme();
  const overlap = overlapProp ?? Math.round(size * 0.4);
  const items = collectElements(children);
  const limit = maxVisible ?? items.length;
  const visibleItems = items.slice(0, limit);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);

  const ringColorResolved =
    theme.colors[ringColor as keyof typeof theme.colors] ?? ringColor;

  const stack = (
    <Box sx={{ flexDirection: 'row', alignItems: 'center' }}>
      <AvatarGroupSlotList
        visibleItems={visibleItems}
        size={size}
        overlap={overlap}
        ringBorderWidth={ringBorderWidth}
        ringColorResolved={ringColorResolved}
      />
      <AvatarGroupOverflow
        hiddenCount={hiddenCount}
        visibleCount={visibleItems.length}
        overlap={overlap}
        size={size}
        ringBorderWidth={ringBorderWidth}
        ringColorResolved={ringColorResolved}
        {...(typeof renderOverflow === 'function' ? { renderOverflow } : {})}
      />
    </Box>
  );

  if (onPress === undefined) {
    return stack;
  }

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {stack}
    </Pressable>
  );
}
