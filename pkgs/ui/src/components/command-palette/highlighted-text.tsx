/** @jsxImportSource solid-js */
/**
 * `HighlightedText` -- renders `text` with the given inclusive index ranges
 * emphasised (`<mark>`-free: bold segments so colours stay on-theme).
 */

import { createMemo, For, type JSX, Show } from 'solid-js';
import { Text, type TextVariant } from '../text';
import { type MatchRange, mergeRanges } from './fuzzy-match';

export type HighlightedTextProps = {
  text: string;
  /** Inclusive index ranges to emphasise inside `text`. */
  ranges: readonly MatchRange[];
  variant?: TextVariant | undefined;
  boldVariant?: TextVariant | undefined;
  numberOfLines?: number | undefined;
};

export type HighlightedSegment = { text: string; bold: boolean };

/** Split `text` into plain / bold segments. Exported for tests. */
export function highlightSegments(
  text: string,
  ranges: readonly MatchRange[]
): HighlightedSegment[] {
  const segments: HighlightedSegment[] = [];
  let cursor = 0;
  for (const [start, end] of mergeRanges(ranges)) {
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), bold: false });
    }
    segments.push({ text: text.slice(start, end + 1), bold: true });
    cursor = end + 1;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), bold: false });
  }
  return segments;
}

export function HighlightedText(props: HighlightedTextProps): JSX.Element {
  const variant = (): TextVariant => props.variant ?? 'body';
  const boldVariant = (): TextVariant => props.boldVariant ?? 'bodyBold';
  const segments = createMemo(() =>
    highlightSegments(props.text, props.ranges)
  );
  const lineProps = (): Pick<HighlightedTextProps, 'numberOfLines'> =>
    props.numberOfLines !== undefined
      ? { numberOfLines: props.numberOfLines }
      : {};
  return (
    <Show
      when={props.ranges.length > 0}
      fallback={
        <Text variant={variant()} {...lineProps()}>
          {props.text}
        </Text>
      }
    >
      <Text variant={variant()} class="shrink" {...lineProps()}>
        <For each={segments()}>
          {(segment) => (
            <Text variant={segment.bold ? boldVariant() : variant()}>
              {segment.text}
            </Text>
          )}
        </For>
      </Text>
    </Show>
  );
}
