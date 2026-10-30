/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { nextRovingIndex } from '@pkgs/ui-root-shared-ts/roving-focus';
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

/** Arrow keys move the selection, wrapping (WAI-ARIA radio group). */
function onSegmentKeyDown(event: KeyboardEvent): void {
  const segment = event.currentTarget;
  if (!(segment instanceof HTMLElement)) return;
  const track = segment.closest('[role="radiogroup"]');
  if (track === null) return;
  const items = Array.from(
    track.querySelectorAll<HTMLButtonElement>('[role="radio"]')
  );
  const current = items.findIndex((item) => item === document.activeElement);
  if (current < 0) return;
  const next = nextRovingIndex({
    key: event.key,
    current,
    disabled: items.map((item) => item.disabled),
    orientation: 'both',
    homeEnd: false,
  });
  if (next === null) return;
  event.preventDefault();
  items[next]?.focus();
  items[next]?.click();
}

function SegmentButton<K extends string>(props: {
  segment: Segment<K>;
  isActive: boolean;
  /** The one segment in the tab order. */
  tabStop: boolean;
  disabled: boolean;
  groupTestId: string | undefined;
  onSelect: (key: K) => void;
}): JSX.Element {
  return (
    <button
      class="clickable segment hitTarget rounded-full flex-1 items-center justify-center min-h-9 px-3 bg-transparent relative z-1"
      classList={{
        clickableTint: !props.isActive,
      }}
      data-component="Segment"
      data-key={props.segment.key}
      data-testid={segmentTestId(props.groupTestId, props.segment.key)}
      type="button"
      role="radio"
      aria-checked={props.isActive}
      tabIndex={props.tabStop ? 0 : -1}
      onKeyDown={onSegmentKeyDown}
      onClick={() => {
        if (!props.isActive) props.onSelect(props.segment.key);
      }}
      disabled={props.disabled}
    >
      <span
        class="text textBodyBold whitespace-nowrap"
        classList={{
          'text-on-primary-soft': props.isActive,
          'text-text': !props.isActive,
        }}
      >
        {props.segment.label}
      </span>
    </button>
  );
}

/**
 * `SegmentedControl` -- horizontal tab-like mode switcher.
 *
 * A row of segments (`role="radiogroup"` / `role="radio"`); exactly one is
 * selected at a time. The track is a clear pill inside the 3:1 `outline`
 * edge with a 4px inset; the selected segment is the soft blue pill
 * (`tint-subtle` fill, `primary-strong` edge, `on-primary-soft` label), the
 * others ink. The indicator is sized as a fraction of the track
 * (`width: calc(100% / n)`, `left` offset by index), so it needs no
 * measurement, and slides in 200ms (`skin.css` `.segmentIndicator`; reduced
 * motion snaps it). Each segment is 36px tall with a 44px hit area that
 * reaches the track edge. Unselected segments take the hover / press tint;
 * every segment shows the focus ring; `disabled` fades the whole control.
 *
 * Keyboard: the group is one tab stop (the selected segment); the arrow
 * keys move to the next or previous segment, wrapping, and select it.
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
      class="box flex-row p-1 gap-1 border border-outline rounded-full relative"
      classList={{ 'opacity-disabled': props.disabled === true }}
      {...dataAttrs({ component: 'SegmentedControl', ...props.dataSet })}
      role="radiogroup"
      aria-label={props['aria-label']}
      aria-disabled={props.disabled === true ? true : undefined}
    >
      <Show when={props.segments.length > 0}>
        <div
          class="box segmentIndicator absolute top-1 bottom-1 rounded-full bg-tint-subtle border border-primary-strong pointer-events-none"
          data-component="SegmentIndicator"
          style={{ left: indicator().left, width: indicator().width }}
          aria-hidden="true"
        />
      </Show>
      <For each={props.segments}>
        {(seg, index) => (
          <SegmentButton
            segment={seg}
            isActive={seg.key === props.selected}
            tabStop={index() === selectedIndex()}
            disabled={props.disabled === true}
            groupTestId={props.dataSet?.['testid']}
            onSelect={props.onSelect}
          />
        )}
      </For>
    </div>
  );
}
