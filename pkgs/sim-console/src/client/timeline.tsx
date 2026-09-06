import { Box, Pressable, ScrollView, Text } from '@pkgs/ui-rn';
import {
  memo,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  LayoutChangeEvent,
  ScrollView as RNScrollView,
} from 'react-native';

import {
  type ScrubMode,
  scrubThumbFraction,
  scrubTickFractions,
} from './frame-scrubber';
import type { FlatFrame } from './frames';
import { formatMs } from './frames';
import { scrollOffsetToReveal } from './timeline-scroll';
import { useScrubSelect } from './use-scrub-select';

const THUMB_SIZE = 16;
const SCRUB_HIT_HEIGHT = 28;
const TICK_WIDTH = 2;
const TICK_HEIGHT = 10;

export function Timeline(props: {
  readonly frames: readonly FlatFrame[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  readonly mode?: ScrubMode;
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
    <Box sx={timelineColumnSx}>
      <FrameScrubber
        mode={props.mode ?? 'continuous'}
        frameCount={props.frames.length}
        selectedIndex={props.selectedIndex}
        onSelect={props.onSelect}
      />
      <ScrollView
        ref={scroll.scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        frameSx={railSx}
        sx={chipRowSx}
        accessibilityLabel="Frames"
        scrollEventThrottle={100}
        onLayout={(e) => {
          scroll.onViewportWidth(e.nativeEvent.layout.width);
        }}
        onScroll={(e) => {
          scroll.onScrollX(e.nativeEvent.contentOffset.x);
        }}
      >
        {props.frames.map((frame, index) => (
          <FrameChip
            key={`${frame.file ?? frame.globalIndex}-${index}`}
            index={index}
            title={frame.step.title}
            durationMs={frame.durationMs}
            selected={index === props.selectedIndex}
            onSelect={props.onSelect}
            onLayout={scroll.onChipLayout}
          />
        ))}
      </ScrollView>
    </Box>
  );
}

function FrameScrubber(props: {
  readonly mode: ScrubMode;
  readonly frameCount: number;
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
}) {
  const { mode, frameCount, selectedIndex, onSelect } = props;
  const [trackWidth, setTrackWidth] = useState(0);
  const scrub = useScrubSelect(frameCount, onSelect);
  const fraction = scrubThumbFraction({ selectedIndex, frameCount });
  const thumbLeft =
    trackWidth <= 0 ? 0 : fraction * Math.max(0, trackWidth - THUMB_SIZE);

  const onTrackLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const width = e.nativeEvent.layout.width;
      scrub.setWidth(width);
      setTrackWidth(width);
    },
    [scrub]
  );

  return (
    <Box
      accessibilityLabel="Frame scrubber"
      accessibilityRole="adjustable"
      accessibilityValue={{
        min: 1,
        max: frameCount,
        now: selectedIndex + 1,
      }}
      sx={{
        ...scrubHitSx,
        cursor: scrub.scrubbing ? 'grabbing' : 'grab',
      }}
      onLayout={onTrackLayout}
      onPointerDown={scrub.onPointerDown}
      onPointerMove={scrub.onPointerMove}
      onPointerUp={scrub.onPointerUp}
      onPointerCancel={scrub.onPointerCancel}
      {...{ onLostPointerCapture: scrub.onLostPointerCapture }}
    >
      <Box sx={scrubTrackSx}>
        <Box sx={{ ...scrubFillSx, width: `${fraction * 100}%` }} />
      </Box>
      {mode === 'discrete' ? (
        <DiscreteTicks frameCount={frameCount} trackWidth={trackWidth} />
      ) : null}
      <Box pointerEvents="none" sx={{ ...scrubThumbSx, left: thumbLeft }} />
    </Box>
  );
}

function DiscreteTicks(props: {
  readonly frameCount: number;
  readonly trackWidth: number;
}) {
  const { frameCount, trackWidth } = props;
  if (trackWidth <= 0 || frameCount <= 0) return null;
  const travel = Math.max(0, trackWidth - THUMB_SIZE);
  const ticks = scrubTickFractions(frameCount);
  return (
    <Box pointerEvents="none" sx={ticksLayerSx}>
      {ticks.map((fraction, index) => (
        <Box
          key={index}
          sx={{
            ...scrubTickSx,
            left: fraction * travel + THUMB_SIZE / 2 - TICK_WIDTH / 2,
          }}
        />
      ))}
    </Box>
  );
}

const FrameChip = memo(function FrameChip(props: {
  readonly index: number;
  readonly title: string;
  readonly durationMs: number;
  readonly selected: boolean;
  readonly onSelect: (index: number) => void;
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
      onPress={() => {
        props.onSelect(index);
      }}
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
});

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

  const reveal = () => {
    const x = scrollOffsetToReveal({
      layout: layoutsRef.current.get(selectedRef.current),
      viewportWidth: viewportWidthRef.current,
      scrollX: scrollXRef.current,
    });
    if (x == null) return;
    scrollRef.current?.scrollTo({ x, animated: false });
  };

  useEffect(() => {
    reveal();
  }, [selectedIndex]);

  return {
    scrollRef,
    onViewportWidth: (width) => {
      viewportWidthRef.current = width;
      reveal();
    },
    onScrollX: (x) => {
      scrollXRef.current = x;
    },
    onChipLayout: (index, x, width) => {
      layoutsRef.current.set(index, { x, width });
      if (index === selectedRef.current) reveal();
    },
  };
}

const timelineColumnSx = {
  flexDirection: 'column',
  gap: 1,
  flexGrow: 0,
} as const;

const scrubHitSx = {
  height: SCRUB_HIT_HEIGHT,
  justifyContent: 'center',
  position: 'relative',
  marginTop: 4,
  marginBottom: 2,
  userSelect: 'none',
  cursor: 'grab',
} as const;

const scrubTrackSx = {
  height: 4,
  borderRadius: 2,
  background: 'outline',
  overflow: 'hidden',
} as const;

const scrubFillSx = {
  height: 4,
  borderRadius: 2,
  background: 'tint',
} as const;

const scrubThumbSx = {
  position: 'absolute',
  top: (SCRUB_HIT_HEIGHT - THUMB_SIZE) / 2,
  width: THUMB_SIZE,
  height: THUMB_SIZE,
  borderRadius: THUMB_SIZE / 2,
  background: 'tint',
  borderWidth: 2,
  borderColor: 'surface',
} as const;

const ticksLayerSx = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
} as const;

const scrubTickSx = {
  position: 'absolute',
  top: (SCRUB_HIT_HEIGHT - TICK_HEIGHT) / 2,
  width: TICK_WIDTH,
  height: TICK_HEIGHT,
  borderRadius: 1,
  background: 'border',
} as const;

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
