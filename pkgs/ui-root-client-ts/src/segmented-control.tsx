/** @jsxImportSource solid-js */
/**
 * `SegmentedControl` -- horizontal tab-like mode switcher.
 *
 * A row of segments (`role="radiogroup"` / `role="radio"`); exactly one is
 * selected at a time. The track is `surface-muted` with the control radius
 * and a 4px inset; the selected segment is the canvas inside a hairline,
 * in full text color, with the others secondary. The indicator is sized as
 * a fraction of the track (`width: calc(100% / n)`, `left` offset by index),
 * so it needs no measurement, and slides in 200ms (`skin.css`
 * `.segmentIndicator`; reduced motion snaps it). Unselected segments take
 * the hover / press tint; every segment shows the focus ring; `disabled`
 * fades the whole control.
 *
 * @example
 * ```tsx
 * <SegmentedControl
 *   segments={[
 *     { key: 'harness', label: 'Harness' },
 *     { key: 'docs', label: 'Docs' },
 *   ]}
 *   selected="harness"
 *   onSelect={setMode}
 * />
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show } from 'solid-js';

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

/** Inset between track edge and the selected pill (`p-1`). */
const CONTAINER_PADDING = 4;
/** Gap between segments (`gap-1`). */
const SEGMENT_GAP = 4;

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

/** Per-segment DOM id derived from the group's `dataSet.testid` (spec). */
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
      class="clickable segment rounded-sm flex-1 items-center justify-center py-2 px-3 bg-transparent relative z-1"
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
        class="text textBodyBold whitespace-nowrap"
        classList={{
          'text-text': props.isActive,
          'text-text-secondary': !props.isActive,
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
      class="box flex-row p-1 gap-1 bg-surface-muted rounded-control relative"
      classList={{ 'opacity-disabled': props.disabled === true }}
      {...dataAttrs({ component: 'SegmentedControl', ...props.dataSet })}
      role="radiogroup"
      aria-label={props['aria-label']}
    >
      <Show when={props.segments.length > 0}>
        <div
          class="box segmentIndicator absolute top-1 bottom-1 rounded-sm bg-background border border-border pointer-events-none"
          data-component="SegmentIndicator"
          style={{ left: indicator().left, width: indicator().width }}
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
