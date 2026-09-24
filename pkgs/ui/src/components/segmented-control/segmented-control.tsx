/** @jsxImportSource solid-js */
import { cssPx } from '../../css/css-px';
/**
 * `SegmentedControl` -- horizontal tab-like mode switcher.
 *
 * A row of segments (`role="radiogroup"` / `role="radio"`); exactly one is
 * selected at a time. The active indicator is a CSS-positioned pill sized as
 * a fraction of the track (`width: calc(100% / n)`, `left` offset by index)
 * and snaps instantly — no measurement or transition.
 *
 * @example
 * ```tsx
 * <SegmentedControl
 *   segments={[
 *     { key: 'simulator', label: 'Simulator' },
 *     { key: 'docs', label: 'Docs' },
 *   ]}
 *   selected="simulator"
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

/** Inset between track edge and the selected pill (and segment row). */
const CONTAINER_PADDING = 4;
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

/** Per-segment DOM id derived from the group's `dataSet.testid` (E2E). */
export function segmentTestId(
  groupTestId: string | undefined,
  key: string
): string | undefined {
  return groupTestId === undefined ? undefined : `${groupTestId}-${key}`;
}

function SegmentButton<K extends string>(props: {
  segment: Segment<K>;
  isActive: boolean;
  disabled: boolean;
  groupTestId: string | undefined;
  onSelect: (key: K) => void;
}): JSX.Element {
  return (
    <button
      class="clickable rounded-sm flex-1 items-center py-3 px-3.5 bg-transparent relative z-1"
      classList={{
        clickableTint: !props.isActive,
      }}
      data-component="Segment"
      data-key={props.segment.key}
      data-testid={segmentTestId(props.groupTestId, props.segment.key)}
      type="button"
      role="radio"
      aria-checked={props.isActive}
      onClick={() => props.onSelect(props.segment.key)}
      disabled={props.disabled}
    >
      <label
        class="text textLabel whitespace-nowrap"
        classList={{
          'text-text': props.isActive,
          'text-text-secondary': !props.isActive,
          'font-semibold': props.isActive,
          'font-medium': !props.isActive,
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
      class="box flex-row bg-surface-muted rounded-control border border-border relative"
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
          class="box absolute rounded-sm bg-surface-elevated border border-border pointer-events-none"
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
            groupTestId={props.dataSet?.['testid']}
            onSelect={props.onSelect}
          />
        )}
      </For>
    </div>
  );
}
