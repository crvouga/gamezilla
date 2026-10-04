/** @jsxImportSource solid-js */
/**
 * `HighlightedText` -- renders `text` with the given inclusive index ranges
 * emphasised (`<mark>`-free: bold segments so colours stay on-theme).
 */

import type { MatchRange } from '@pkgs/ui-shared/fuzzy-match';
import { mergeRanges } from '@pkgs/ui-shared/fuzzy-match';
import { createMemo, For, type JSX, Show } from 'solid-js';
import type { TextVariant } from './text';

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

function variantClassList(variant: TextVariant): Record<string, boolean> {
  return {
    textBodyBold: variant === 'bodyBold',
    textCaption: variant === 'caption',
    textLabel: variant === 'label',
    textTitle: variant === 'title',
    textSubtitle: variant === 'subtitle',
    textHeading: variant === 'heading',
    textNavigationTitle: variant === 'navigationTitle',
    textLink: variant === 'link',
    textMono: variant === 'mono',
  };
}

export function HighlightedText(props: HighlightedTextProps): JSX.Element {
  const variant = (): TextVariant => props.variant ?? 'body';
  const boldVariant = (): TextVariant => props.boldVariant ?? 'bodyBold';
  const segments = createMemo(() =>
    highlightSegments(props.text, props.ranges)
  );
  const clampOne = (): boolean => props.numberOfLines === 1;
  return (
    <Show
      when={props.ranges.length > 0}
      fallback={
        <p
          class="text"
          classList={{
            ...variantClassList(variant()),
            'line-clamp-1': clampOne(),
          }}
        >
          {props.text}
        </p>
      }
    >
      <p
        class="text shrink min-w-0"
        classList={{
          ...variantClassList(variant()),
          'line-clamp-1': clampOne(),
        }}
      >
        <For each={segments()}>
          {(segment) => (
            <span
              classList={variantClassList(
                segment.bold ? boldVariant() : variant()
              )}
            >
              {segment.text}
            </span>
          )}
        </For>
      </p>
    </Show>
  );
}
