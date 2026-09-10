/** @jsxImportSource solid-js */
import { cssPx } from '../../css/css-px';
/**
 * `SegmentedControl` -- horizontal tab-like mode switcher.
 *
 * A row of segments (`role="radiogroup"` / `role="radio"`); exactly one is
 * selected at a time. The active indicator is a CSS-positioned pill sized as
 * a fraction of the track (`width: calc(100% / n)`, `left` offset by index)
 * and slides with a CSS transition -- no measurement.
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

import { For, type JSX, Show } from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';

export type Segment<K extends string = string> = {
  key: K;
  label: string;
};

export type SegmentedControlProps<K extends string = string> = {
  segments: readonly Segment<K>[];
  selected: K;
  onSelect: (key: K) => void;
  disabled?: boolean | undefined;
  /** Accessible name for the group. */
  'aria-label'?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const CONTAINER_PADDING = 3;
const SEGMENT_GAP = 2;

/** CSS geometry for the sliding indicator (pure; exported for tests). */
export function segmentIndicatorCss(
  index: number,
  count: number
): { width: string; left: string } {
  const gaps = Math.max(0, count - 1) * SEGMENT_GAP;
  const width = `calc((100% - ${CONTAINER_PADDING * 2}px - ${gaps}px) / ${count})`;
  const left = `calc(${CONTAINER_PADDING}px + ${index} * (${width} + ${SEGMENT_GAP}px))`;
  return { width, left };
}

function SegmentButton<K extends string>(props: {
  segment: Segment<K>;
  isActive: boolean;
  disabled: boolean;
  onSelect: (key: K) => void;
}): JSX.Element {
  return (
    <button
      class="clickable rounded-[6px] flex-1 items-center [padding-top:8px;padding-bottom:8px] [padding-left:14px;padding-right:14px] bg-transparent relative z-1"
      classList={{
        clickableOpacity:
          String(props.isActive ? 'none' : 'tint') === 'opacity',
        clickableTint:
          String(props.isActive ? 'none' : 'tint') !== 'opacity' &&
          String(props.isActive ? 'none' : 'tint') !== 'none',
      }}
      data-component="Segment"
      data-key={props.segment.key}
      type="button"
      role="radio"
      aria-checked={props.isActive}
      onClick={() => props.onSelect(props.segment.key)}
      disabled={props.disabled}
    >
      <label
        class="text textLabel whitespace-nowrap"
        style={{
          color: props.isActive ? 'text' : 'textSecondary',
          'font-weight': props.isActive ? '600' : '500',
        }}
      >
        {props.segment.label}
      </label>
    </button>
  );
}

export function SegmentedControl<K extends string = string>(
  props: SegmentedControlProps<K>
): JSX.Element {
  const selectedIndex = (): number =>
    Math.max(
      0,
      props.segments.findIndex((s) => s.key === props.selected)
    );
  const indicator = () =>
    segmentIndicatorCss(selectedIndex(), props.segments.length);
  return (
    <div
      class="box flex-row bg-surface-muted rounded-[10px] border border-border relative"
      {...dataAttrs({ component: 'SegmentedControl', ...props.dataSet })}
      style={{
        padding: cssPx(CONTAINER_PADDING),
        gap: `${(SEGMENT_GAP / 4) * 4}px`,
      }}
      role="radiogroup"
      aria-label={props['aria-label']}
    >
      <Show when={props.segments.length > 0}>
        <div
          class="box absolute rounded-[6px] bg-surface-elevated border border-border pointer-events-none [transition-property:left,_width] [transition-duration:var(--ui-duration-normal)] [transition-timing-function:var(--ui-easing-standard)]"
          data-component="SegmentIndicator"
          style={{
            top: cssPx(CONTAINER_PADDING),
            bottom: cssPx(CONTAINER_PADDING),
            left: cssPx(indicator().left),
            width: cssPx(indicator().width),
          }}
          aria-hidden="true"
        />
      </Show>
      <For each={props.segments}>
        {(seg) => (
          <SegmentButton
            segment={seg}
            isActive={seg.key === props.selected}
            disabled={props.disabled === true}
            onSelect={props.onSelect}
          />
        )}
      </For>
    </div>
  );
}
