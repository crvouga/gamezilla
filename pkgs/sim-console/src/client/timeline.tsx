import { Pressable, ScrollView, Text } from '@pkgs/ui';
import { type RefObject, useEffect, useRef } from 'react';
import type { ScrollView as RNScrollView } from 'react-native';

import type { FlatFrame } from './frames';
import { formatMs } from './frames';
import { scrollOffsetToReveal } from './timeline-scroll';

export function Timeline(props: {
  readonly frames: readonly FlatFrame[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
}) {
  const scroll = useTimelineScroll(props.selectedIndex);
  if (props.frames.length === 0) {
    return (
      <Text sx={{ ...railSx, color: 'textSecondary', padding: 10 }}>
        No frames.
      </Text>
    );
  }

  return (
    <ScrollView
      ref={scroll.scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      frameSx={railSx}
      sx={chipRowSx}
      accessibilityLabel="Frames"
      scrollEventThrottle={16}
      onLayout={(e) => {
        scroll.onViewportWidth(e.nativeEvent.layout.width);
      }}
      onScroll={(e) => {
        scroll.onScrollX(e.nativeEvent.contentOffset.x);
      }}
    >
      {props.frames.map((frame, index) => (
        <FrameChip
          key={`${frame.file}-${index}`}
          index={index}
          title={frame.step.title}
          durationMs={frame.durationMs}
          selected={index === props.selectedIndex}
          onPress={() => props.onSelect(index)}
          onLayout={scroll.onChipLayout}
        />
      ))}
    </ScrollView>
  );
}

function FrameChip(props: {
  readonly index: number;
  readonly title: string;
  readonly durationMs: number;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly onLayout: (index: number, x: number, width: number) => void;
}) {
  const { index, selected } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        paddingVertical: 4,
        paddingHorizontal: 8,
        background: selected ? 'tintSubtle' : 'background',
        borderWidth: 1,
        borderColor: selected ? 'tint' : 'border',
        borderRadius: 'md',
      }}
      onPress={props.onPress}
      onLayout={(e) => {
        const { x, width } = e.nativeEvent.layout;
        props.onLayout(index, x, width);
      }}
    >
      <Text
        sx={{
          fontWeight: '600',
          fontSize: 11,
          color: selected ? 'tint' : 'textSecondary',
        }}
        label={String(index + 1)}
      />
      <Text
        numberOfLines={1}
        sx={{
          fontSize: 11,
          maxWidth: 160,
          color: selected ? 'text' : 'textSecondary',
        }}
        label={props.title}
      />
      <Text
        sx={{ fontSize: 10, color: 'textSecondary' }}
        label={formatMs(props.durationMs)}
      />
    </Pressable>
  );
}

function useTimelineScroll(selectedIndex: number): {
  readonly scrollRef: RefObject<RNScrollView | null>;
  readonly onViewportWidth: (width: number) => void;
  readonly onScrollX: (x: number) => void;
  readonly onChipLayout: (index: number, x: number, width: number) => void;
} {
  const scrollRef = useRef<RNScrollView | null>(null);
  const layoutsRef = useRef(new Map<number, { x: number; width: number }>());
  const viewportWidthRef = useRef(0);
  const scrollXRef = useRef(0);
  const selectedRef = useRef(selectedIndex);
  selectedRef.current = selectedIndex;

  const reveal = (animated: boolean) => {
    const x = scrollOffsetToReveal({
      layout: layoutsRef.current.get(selectedRef.current),
      viewportWidth: viewportWidthRef.current,
      scrollX: scrollXRef.current,
    });
    if (x == null) return;
    scrollRef.current?.scrollTo({ x, animated });
  };

  useEffect(() => {
    reveal(true);
  }, [selectedIndex]);

  return {
    scrollRef,
    onViewportWidth: (width) => {
      viewportWidthRef.current = width;
      reveal(false);
    },
    onScrollX: (x) => {
      scrollXRef.current = x;
    },
    onChipLayout: (index, x, width) => {
      layoutsRef.current.set(index, { x, width });
      if (index === selectedRef.current) reveal(false);
    },
  };
}

const railSx = {
  paddingTop: 6,
  paddingBottom: 8,
  background: 'surface',
  minHeight: 36,
  flexGrow: 0,
} as const;

const chipRowSx = {
  flexDirection: 'row',
  gap: 1,
  alignItems: 'center',
} as const;
