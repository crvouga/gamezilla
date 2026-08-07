import type { ReactNode } from 'react';
import { Text as RNText } from 'react-native';
import type { TextVariant } from '../text';
import { Text } from '../text';

type Props = {
  text: string;
  /** Inclusive index ranges to emphasize inside `text`. */
  ranges: [number, number][];
  variant?: TextVariant;
  boldVariant?: TextVariant;
};

/**
 * Renders `text` with matched ranges in bold.
 */
export function HighlightedText({
  text,
  ranges,
  variant = 'body',
  boldVariant = 'bodyBold',
}: Props) {
  if (ranges.length === 0) {
    return <Text variant={variant} label={text} />;
  }

  const merged: [number, number][] = [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && r[0] <= last[1] + 1) {
      last[1] = Math.max(last[1], r[1]);
    } else {
      merged.push([r[0], r[1]]);
    }
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) {
      nodes.push(
        <Text
          key={`p-${cursor}`}
          variant={variant}
          label={text.slice(cursor, start)}
        />
      );
    }
    nodes.push(
      <Text
        key={`b-${start}`}
        variant={boldVariant}
        label={text.slice(start, end + 1)}
      />
    );
    cursor = end + 1;
  }
  if (cursor < text.length) {
    nodes.push(
      <Text key={`t-${cursor}`} variant={variant} label={text.slice(cursor)} />
    );
  }

  return <RNText style={{ flexShrink: 1 }}>{nodes}</RNText>;
}
