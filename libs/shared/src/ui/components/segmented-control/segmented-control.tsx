/**
 * `SegmentedControl` -- horizontal tab-like mode switcher.
 *
 * A row of pressable segments; exactly one is selected at a time. The active
 * indicator springs between segments using RN's `Animated` API so it works on
 * iOS, Android, and Web (via react-native-web).
 *
 * @example
 * ```tsx
 * <SegmentedControl
 *   segments={[
 *     { key: 'playground', label: 'Playground' },
 *     { key: 'docs', label: 'Docs' },
 *   ]}
 *   selected="playground"
 *   onSelect={setMode}
 * />
 * ```
 */

import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Text } from '../text';

export type Segment<K extends string = string> = {
  key: K;
  label: string;
};

export type SegmentedControlProps<K extends string = string> = {
  segments: Segment<K>[];
  selected: K;
  onSelect: (key: K) => void;
  disabled?: boolean;
};

const CONTAINER_PADDING = 3;
const SEGMENT_GAP = 2;

export function SegmentedControl<K extends string = string>({
  segments,
  selected,
  onSelect,
  disabled = false,
}: SegmentedControlProps<K>) {
  const theme = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  const selectedIndex = Math.max(
    0,
    segments.findIndex((s) => s.key === selected)
  );
  const segmentCount = segments.length;
  const totalGap = SEGMENT_GAP * Math.max(0, segmentCount - 1);
  const innerWidth = Math.max(0, containerWidth - CONTAINER_PADDING * 2);
  const segmentWidth =
    segmentCount > 0 ? (innerWidth - totalGap) / segmentCount : 0;
  const targetX = selectedIndex * (segmentWidth + SEGMENT_GAP);

  const hasMeasuredRef = useRef(false);
  useEffect(() => {
    if (segmentWidth <= 0) return;
    if (!hasMeasuredRef.current) {
      // On first measurement, snap without animating to avoid a jump-in.
      translateX.setValue(targetX);
      hasMeasuredRef.current = true;
      return;
    }
    const animation = Animated.spring(translateX, {
      toValue: targetX,
      useNativeDriver: true,
      stiffness: 260,
      damping: 28,
      mass: 1,
    });
    animation.start();
    return () => animation.stop();
  }, [targetX, segmentWidth, translateX]);

  return (
    <View
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderRadius: borderRadius.md,
        padding: CONTAINER_PADDING,
        gap: SEGMENT_GAP,
        position: 'relative',
      }}
    >
      {segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: CONTAINER_PADDING,
            bottom: CONTAINER_PADDING,
            left: CONTAINER_PADDING,
            width: segmentWidth,
            borderRadius: borderRadius.sm,
            backgroundColor: theme.colors.surface,
            boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
            elevation: 2,
            transform: [{ translateX }],
          }}
        />
      )}
      {segments.map((seg) => {
        const isActive = seg.key === selected;
        return (
          <Pressable
            key={seg.key}
            onPress={() => onSelect(seg.key)}
            disabled={disabled || isActive}
            style={({ pressed }) => [
              {
                flex: 1,
                alignItems: 'center' as const,
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: borderRadius.sm,
                backgroundColor: 'transparent',
              },
              pressed && !isActive && { opacity: 0.7 },
            ]}
          >
            <Text
              variant="label"
              style={{
                color: isActive
                  ? theme.colors.text
                  : theme.colors.textSecondary,
                fontWeight: isActive ? '600' : '400',
              }}
              label={seg.label}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
