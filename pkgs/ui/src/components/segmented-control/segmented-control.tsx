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
import { Animated, View } from 'react-native';
import { componentDataSet, type ComponentDataSet } from '../../component-id';
import { USE_NATIVE_DRIVER } from '../../animation/use-native-driver';
import { useTheme, type Theme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Pressable } from '../pressable';
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
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

const CONTAINER_PADDING = 3;
const SEGMENT_GAP = 2;

function useSegmentLayout(containerWidth: number, segmentCount: number) {
  const totalGap = SEGMENT_GAP * Math.max(0, segmentCount - 1);
  const innerWidth = Math.max(0, containerWidth - CONTAINER_PADDING * 2);
  const segmentWidth =
    segmentCount > 0 ? (innerWidth - totalGap) / segmentCount : 0;
  return segmentWidth;
}

function useSegmentIndicator(
  translateX: Animated.Value,
  targetX: number,
  segmentWidth: number
) {
  const hasMeasuredRef = useRef(false);
  useEffect(() => {
    if (segmentWidth <= 0) return;
    if (!hasMeasuredRef.current) {
      translateX.setValue(targetX);
      hasMeasuredRef.current = true;
      return;
    }
    const animation = Animated.spring(translateX, {
      toValue: targetX,
      useNativeDriver: USE_NATIVE_DRIVER,
      stiffness: 260,
      damping: 28,
      mass: 1,
    });
    animation.start();
    return () => animation.stop();
  }, [targetX, segmentWidth, translateX]);
}

export function SegmentedControl<K extends string = string>({
  segments,
  selected,
  onSelect,
  disabled = false,
  dataSet,
}: SegmentedControlProps<K>) {
  const theme = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  const selectedIndex = Math.max(
    0,
    segments.findIndex((s) => s.key === selected)
  );
  const segmentWidth = useSegmentLayout(containerWidth, segments.length);
  const targetX = selectedIndex * (segmentWidth + SEGMENT_GAP);
  useSegmentIndicator(translateX, targetX, segmentWidth);

  return (
    <View
      {...componentDataSet('SegmentedControl', dataSet)}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: CONTAINER_PADDING,
        gap: SEGMENT_GAP,
        position: 'relative',
      }}
    >
      {segmentWidth > 0 ? (
        <SegmentIndicator
          width={segmentWidth}
          translateX={translateX}
          theme={theme}
        />
      ) : null}
      {segments.map((seg) => (
        <SegmentButton
          key={seg.key}
          segment={seg}
          isActive={seg.key === selected}
          disabled={disabled}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}

function SegmentIndicator({
  width,
  translateX,
  theme,
}: {
  width: number;
  translateX: Animated.Value;
  theme: Theme;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: CONTAINER_PADDING,
        bottom: CONTAINER_PADDING,
        left: CONTAINER_PADDING,
        width,
        borderRadius: borderRadius.sm,
        backgroundColor: theme.colors.surfaceElevated,
        borderWidth: 1,
        borderColor: theme.colors.border,
        transform: [{ translateX }],
      }}
    />
  );
}

function SegmentButton<K extends string>({
  segment,
  isActive,
  disabled,
  onSelect,
}: {
  segment: Segment<K>;
  isActive: boolean;
  disabled: boolean;
  onSelect: (key: K) => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => onSelect(segment.key)}
      disabled={disabled || isActive}
      feedback={isActive ? 'none' : 'tint'}
      sx={{ borderRadius: borderRadius.sm }}
      style={{
        flex: 1,
        alignItems: 'center' as const,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: borderRadius.sm,
        backgroundColor: 'transparent',
      }}
    >
      <Text
        variant="label"
        style={{
          color: isActive ? theme.colors.text : theme.colors.textSecondary,
          fontWeight: isActive ? '600' : '500',
        }}
        label={segment.label}
      />
    </Pressable>
  );
}
