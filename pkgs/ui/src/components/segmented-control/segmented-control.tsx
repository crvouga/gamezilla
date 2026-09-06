/** @jsxImportSource solid-js */
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
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { Text } from '../text';

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
    <Clickable
      role="radio"
      aria-checked={props.isActive}
      onClick={() => props.onSelect(props.segment.key)}
      disabled={props.disabled}
      feedback={props.isActive ? 'none' : 'tint'}
      dataSet={{ component: 'Segment', key: props.segment.key }}
      sx={{
        borderRadius: 'sm',
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: 'transparent',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <Text
        variant="label"
        sx={{
          color: props.isActive ? 'text' : 'textSecondary',
          fontWeight: props.isActive ? '600' : '500',
          whiteSpace: 'nowrap',
        }}
        label={props.segment.label}
      />
    </Clickable>
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
    <Box
      role="radiogroup"
      aria-label={props['aria-label']}
      dataSet={{ component: 'SegmentedControl', ...props.dataSet }}
      sx={{
        flexDirection: 'row',
        backgroundColor: 'surfaceMuted',
        borderRadius: 'md',
        borderWidth: 1,
        borderColor: 'border',
        padding: CONTAINER_PADDING,
        gap: SEGMENT_GAP / 4,
        position: 'relative',
      }}
    >
      <Show when={props.segments.length > 0}>
        <Box
          aria-hidden="true"
          dataSet={{ component: 'SegmentIndicator' }}
          sx={{
            position: 'absolute',
            top: CONTAINER_PADDING,
            bottom: CONTAINER_PADDING,
            left: indicator().left,
            width: indicator().width,
            borderRadius: 'sm',
            backgroundColor: 'surfaceElevated',
            borderWidth: 1,
            borderColor: 'border',
            pointerEvents: 'none',
            transitionProperty: 'left, width',
            transitionDuration: 'var(--ui-duration-normal)',
            transitionTimingFunction: 'var(--ui-easing-standard)',
          }}
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
    </Box>
  );
}
