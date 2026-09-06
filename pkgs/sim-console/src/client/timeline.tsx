import { Box, Clickable, ScrollView, Text } from '@pkgs/ui';
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';

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
  const scroll = useTimelineScroll(() => props.selectedIndex);
  return (
    <Show
      when={props.frames.length > 0}
      fallback={
        <Text sx={{ ...railSx, color: 'textSecondary', padding: 10 }}>
          No frames.
        </Text>
      }
    >
      <Box sx={timelineColumnSx}>
        <FrameScrubber
          mode={props.mode ?? 'continuous'}
          frameCount={props.frames.length}
          selectedIndex={props.selectedIndex}
          onSelect={props.onSelect}
        />
        <ScrollView
          ref={scroll.onScroller}
          horizontal
          hideScrollbar
          frameSx={railSx}
          sx={chipRowSx}
          aria-label="Frames"
          onScroll={(e) => {
            scroll.onScrollX(e.currentTarget.scrollLeft);
          }}
        >
          <For each={props.frames}>
            {(frame, index) => (
              <FrameChip
                index={index()}
                title={frame.step.title}
                durationMs={frame.durationMs}
                selected={index() === props.selectedIndex}
                onSelect={props.onSelect}
                onLayout={scroll.onChipLayout}
              />
            )}
          </For>
        </ScrollView>
      </Box>
    </Show>
  );
}

function FrameScrubber(props: {
  readonly mode: ScrubMode;
  readonly frameCount: number;
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
}) {
  const [trackWidth, setTrackWidth] = createSignal(0);
  const scrub = useScrubSelect(
    () => props.frameCount,
    (index) => props.onSelect(index)
  );
  const fraction = () =>
    scrubThumbFraction({
      selectedIndex: props.selectedIndex,
      frameCount: props.frameCount,
    });
  const thumbLeft = () =>
    trackWidth() <= 0 ? 0 : fraction() * Math.max(0, trackWidth() - THUMB_SIZE);

  const onTrackRef = (el: HTMLElement) => {
    const apply = () => {
      scrub.setWidth(el.clientWidth);
      setTrackWidth(el.clientWidth);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    onCleanup(() => observer.disconnect());
  };

  return (
    <Box
      aria-label="Frame scrubber"
      role="slider"
      aria-valuemin={1}
      aria-valuemax={props.frameCount}
      aria-valuenow={props.selectedIndex + 1}
      sx={{
        ...scrubHitSx,
        cursor: scrub.scrubbing ? 'grabbing' : 'grab',
      }}
      ref={onTrackRef}
      onPointerDown={scrub.onPointerDown}
      onPointerMove={scrub.onPointerMove}
      onPointerUp={scrub.onPointerUp}
      onPointerCancel={scrub.onPointerCancel}
      onLostPointerCapture={scrub.onLostPointerCapture}
    >
      <Box sx={scrubTrackSx}>
        <Box sx={{ ...scrubFillSx, width: `${fraction() * 100}%` }} />
      </Box>
      <Show when={props.mode === 'discrete'}>
        <DiscreteTicks
          frameCount={props.frameCount}
          trackWidth={trackWidth()}
        />
      </Show>
      <Box
        sx={{
          ...scrubThumbSx,
          pointerEvents: 'none',
          left: `${thumbLeft()}px`,
        }}
      />
    </Box>
  );
}

function DiscreteTicks(props: {
  readonly frameCount: number;
  readonly trackWidth: number;
}) {
  const travel = () => Math.max(0, props.trackWidth - THUMB_SIZE);
  const ticks = () => scrubTickFractions(props.frameCount);
  return (
    <Show when={props.trackWidth > 0 && props.frameCount > 0}>
      <Box sx={{ ...ticksLayerSx, pointerEvents: 'none' }}>
        <For each={ticks()}>
          {(fraction) => (
            <Box
              sx={{
                ...scrubTickSx,
                left: `${fraction * travel() + THUMB_SIZE / 2 - TICK_WIDTH / 2}px`,
              }}
            />
          )}
        </For>
      </Box>
    </Show>
  );
}

function FrameChip(props: {
  readonly index: number;
  readonly title: string;
  readonly durationMs: number;
  readonly selected: boolean;
  readonly onSelect: (index: number) => void;
  readonly onLayout: (index: number, x: number, width: number) => void;
}) {
  return (
    <Clickable
      aria-selected={props.selected}
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        paddingVertical: 4,
        paddingHorizontal: 8,
        background: props.selected ? 'tintSubtle' : 'background',
        borderWidth: 1,
        borderColor: props.selected ? 'tint' : 'border',
        borderRadius: 'md',
      }}
      ref={(el) => {
        props.onLayout(props.index, el.offsetLeft, el.offsetWidth);
      }}
      onClick={() => {
        props.onSelect(props.index);
      }}
    >
      <Text
        sx={{
          fontWeight: '600',
          fontSize: 11,
          color: props.selected ? 'tint' : 'textSecondary',
        }}
        label={String(props.index + 1)}
      />
      <Text
        numberOfLines={1}
        sx={{
          fontSize: 11,
          maxWidth: 160,
          color: props.selected ? 'text' : 'textSecondary',
        }}
        label={props.title}
      />
      <Text
        sx={{ fontSize: 10, color: 'textSecondary' }}
        label={formatMs(props.durationMs)}
      />
    </Clickable>
  );
}

function useTimelineScroll(selectedIndex: () => number): {
  readonly onScroller: (el: HTMLDivElement) => void;
  readonly onScrollX: (x: number) => void;
  readonly onChipLayout: (index: number, x: number, width: number) => void;
} {
  let scroller: HTMLDivElement | null = null;
  const layouts = new Map<number, { x: number; width: number }>();
  let viewportWidth = 0;
  let scrollX = 0;

  const reveal = () => {
    const x = scrollOffsetToReveal({
      layout: layouts.get(selectedIndex()),
      viewportWidth,
      scrollX,
    });
    if (x == null) return;
    scroller?.scrollTo({ left: x });
  };

  createEffect(() => {
    selectedIndex();
    reveal();
  });

  return {
    onScroller: (el) => {
      scroller = el;
      viewportWidth = el.clientWidth;
      const observer = new ResizeObserver(() => {
        viewportWidth = el.clientWidth;
        reveal();
      });
      observer.observe(el);
      onCleanup(() => observer.disconnect());
      reveal();
    },
    onScrollX: (x) => {
      scrollX = x;
    },
    onChipLayout: (index, x, width) => {
      layouts.set(index, { x, width });
      if (index === selectedIndex()) reveal();
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
