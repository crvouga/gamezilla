import { ScrollView } from '@pkgs/ui';
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
        <p class="text text-text-secondary p-[10px]" style={railSx}>
          No frames.
        </p>
      }
    >
      <div class="box" style={timelineColumnSx}>
        <FrameScrubber
          mode={props.mode ?? 'continuous'}
          frameCount={props.frames.length}
          selectedIndex={props.selectedIndex}
          onSelect={props.onSelect}
        />
        <ScrollView
          style={railSx}
          contentStyle={chipRowSx}
          ref={scroll.onScroller}
          horizontal
          hideScrollbar
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
      </div>
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
    <div
      class="box"
      style={{
        ...(scrubHitSx ?? {}),
        cursor: scrub.scrubbing ? 'grabbing' : 'grab',
      }}
      aria-label="Frame scrubber"
      role="slider"
      aria-valuemin={1}
      aria-valuemax={props.frameCount}
      aria-valuenow={props.selectedIndex + 1}
      ref={onTrackRef}
      onPointerDown={scrub.onPointerDown}
      onPointerMove={scrub.onPointerMove}
      onPointerUp={scrub.onPointerUp}
      onPointerCancel={scrub.onPointerCancel}
      onLostPointerCapture={scrub.onLostPointerCapture}
    >
      <div class="box" style={scrubTrackSx}>
        <div
          class="box"
          style={{ ...(scrubFillSx ?? {}), width: `${fraction() * 100}%` }}
        />
      </div>
      <Show when={props.mode === 'discrete'}>
        <DiscreteTicks
          frameCount={props.frameCount}
          trackWidth={trackWidth()}
        />
      </Show>
      <div
        class="box pointer-events-none"
        style={{ ...(scrubThumbSx ?? {}), left: `${thumbLeft()}px` }}
      />
    </div>
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
      <div class="box pointer-events-none" style={ticksLayerSx}>
        <For each={ticks()}>
          {(fraction) => (
            <div
              class="box"
              style={{
                ...(scrubTickSx ?? {}),
                left: `${fraction * travel() + THUMB_SIZE / 2 - TICK_WIDTH / 2}px`,
              }}
            />
          )}
        </For>
      </div>
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
    <button
      class="clickable clickableTint flex-row items-center gap-1 [padding-top:4px;padding-bottom:4px] [padding-left:8px;padding-right:8px] border rounded-[10px]"
      style={{
        background: props.selected ? 'tintSubtle' : 'background',
        'border-color': props.selected ? 'tint' : 'border',
      }}
      type="button"
      aria-selected={props.selected}
      ref={(el) => {
        props.onLayout(props.index, el.offsetLeft, el.offsetWidth);
      }}
      onClick={() => {
        props.onSelect(props.index);
      }}
    >
      <p
        class="text font-semibold text-[11px]"
        style={{ color: props.selected ? 'tint' : 'textSecondary' }}
      >
        {String(props.index + 1)}
      </p>
      <p
        class="text line-clamp-1 text-[11px] max-w-[160px]"
        style={{ color: props.selected ? 'text' : 'textSecondary' }}
      >
        {props.title}
      </p>
      <p class="text text-[10px] text-text-secondary">
        {formatMs(props.durationMs)}
      </p>
    </button>
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
  'flex-direction': 'column',
  gap: '4px',
  'flex-grow': 0,
} as const;

const scrubHitSx = {
  height: `${SCRUB_HIT_HEIGHT}px`,
  'justify-content': 'center',
  position: 'relative',
  'margin-top': '16px',
  'margin-bottom': '8px',
  'user-select': 'none',
  cursor: 'grab',
} as const;

const scrubTrackSx = {
  height: '4px',
  'border-radius': '2px',
  background: 'outline',
  overflow: 'hidden',
} as const;

const scrubFillSx = {
  height: '4px',
  'border-radius': '2px',
  background: 'tint',
} as const;

const scrubThumbSx = {
  position: 'absolute',
  top: `${(SCRUB_HIT_HEIGHT - THUMB_SIZE) / 2}px`,
  width: `${THUMB_SIZE}px`,
  height: `${THUMB_SIZE}px`,
  'border-radius': `${THUMB_SIZE / 2}px`,
  background: 'tint',
  'border-width': '2px',
  'border-color': 'surface',
} as const;

const ticksLayerSx = {
  position: 'absolute',
  left: '0',
  right: '0',
  top: '0',
  bottom: '0',
} as const;

const scrubTickSx = {
  position: 'absolute',
  top: `${(SCRUB_HIT_HEIGHT - TICK_HEIGHT) / 2}px`,
  width: `${TICK_WIDTH}px`,
  height: `${TICK_HEIGHT}px`,
  'border-radius': '1px',
  background: 'border',
} as const;

const railSx = {
  'padding-top': '24px',
  'padding-bottom': '32px',
  background: 'surface',
  'min-height': '36px',
  'flex-grow': 0,
} as const;

const chipRowSx = {
  'flex-direction': 'row',
  gap: '4px',
  'align-items': 'center',
} as const;
