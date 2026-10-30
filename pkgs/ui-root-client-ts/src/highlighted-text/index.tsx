/** @jsxImportSource solid-js */

import type { MatchRange } from '@pkgs/ui-root-shared-ts/fuzzy-match';
import { mergeRanges } from '@pkgs/ui-root-shared-ts/fuzzy-match';
import { createMemo, For, type JSX, Show } from 'solid-js';
import type { TextRole } from '../text/index';

export type HighlightedTextProps = {
  text: string;
  /** Inclusive index ranges to emphasise inside `text`. */
  ranges: readonly MatchRange[];
  /** Role of the plain runs. Default `body`. */
  variant?: TextRole | undefined;
  /** Role of the matched runs. Default `bodyBold`. */
  boldVariant?: TextRole | undefined;
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

const ROLE_CLASS: Readonly<Record<TextRole, string>> = {
  body: 'textBody',
  bodyBold: 'textBodyBold',
  label: 'textLabel',
  caption: 'textCaption',
  footnote: 'textFootnote',
  sectionLabel: 'textSectionLabel',
  stat: 'textStat',
  mono: 'textMono',
};

function variantClassList(variant: TextRole): Record<string, boolean> {
  return { [ROLE_CLASS[variant]]: true };
}

/**
 * `HighlightedText` -- renders `text` with the given inclusive index ranges
 * emphasised (`<mark>`-free: bold segments so colours stay on-theme).
 */
export function HighlightedText(props: HighlightedTextProps): JSX.Element {
  const variant = (): TextRole => props.variant ?? 'body';
  const boldVariant = (): TextRole => props.boldVariant ?? 'bodyBold';
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
