/** @jsxImportSource solid-js */
/**
 * `HighlightedText` -- renders `text` with the given inclusive index ranges
 * emphasised (`<mark>`-free: bold segments so colours stay on-theme).
 */

import { createMemo, For, type JSX, Show } from 'solid-js';
import type { TextVariant } from '../text';
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
        <p
          class="text"
          classList={{
            textBodyBold: String(variant()) === 'bodyBold',
            textCaption: String(variant()) === 'caption',
            textLabel: String(variant()) === 'label',
            textTitle: String(variant()) === 'title',
            textSubtitle: String(variant()) === 'subtitle',
            textHeading: String(variant()) === 'heading',
            textNavigationTitle: String(variant()) === 'navigationTitle',
            textLink: String(variant()) === 'link',
            textMono: String(variant()) === 'mono',
          }}
          {...lineProps()}
        >
          {props.text}
        </p>
      }
    >
      <p
        class="text shrink"
        classList={{
          textBodyBold: String(variant()) === 'bodyBold',
          textCaption: String(variant()) === 'caption',
          textLabel: String(variant()) === 'label',
          textTitle: String(variant()) === 'title',
          textSubtitle: String(variant()) === 'subtitle',
          textHeading: String(variant()) === 'heading',
          textNavigationTitle: String(variant()) === 'navigationTitle',
          textLink: String(variant()) === 'link',
          textMono: String(variant()) === 'mono',
        }}
        {...lineProps()}
      >
        <For each={segments()}>
          {(segment) => (
            <p
              class="text"
              classList={{
                textBodyBold:
                  String(segment.bold ? boldVariant() : variant()) ===
                  'bodyBold',
                textCaption:
                  String(segment.bold ? boldVariant() : variant()) ===
                  'caption',
                textLabel:
                  String(segment.bold ? boldVariant() : variant()) === 'label',
                textTitle:
                  String(segment.bold ? boldVariant() : variant()) === 'title',
                textSubtitle:
                  String(segment.bold ? boldVariant() : variant()) ===
                  'subtitle',
                textHeading:
                  String(segment.bold ? boldVariant() : variant()) ===
                  'heading',
                textNavigationTitle:
                  String(segment.bold ? boldVariant() : variant()) ===
                  'navigationTitle',
                textLink:
                  String(segment.bold ? boldVariant() : variant()) === 'link',
                textMono:
                  String(segment.bold ? boldVariant() : variant()) === 'mono',
              }}
            >
              {segment.text}
            </p>
          )}
        </For>
      </p>
    </Show>
  );
}
