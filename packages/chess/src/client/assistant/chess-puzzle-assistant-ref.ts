const PREFIX = 'assistant.chess.puzzle.';

export type ChessPuzzleAssistantRefParts = {
  readonly bucket: string;
  readonly theme: string;
  readonly variation: number;
};

/**
 * Parses `assistant.chess.puzzle.{bucket}.{theme}.{variation}` where
 * `theme` may contain dots (future-proof); `variation` is a non-negative int.
 */
export function parseChessPuzzleAssistantRef(
  ref: string
): ChessPuzzleAssistantRefParts | null {
  if (!ref.startsWith(PREFIX)) {
    return null;
  }
  const rest = ref.slice(PREFIX.length);
  const parts = rest.split('.');
  if (parts.length < 3) {
    return null;
  }
  const nStr = parts[parts.length - 1]!;
  const variation = Number.parseInt(nStr, 10);
  if (!Number.isInteger(variation) || variation < 0) {
    return null;
  }
  const bucket = parts[0]!;
  const theme = parts.slice(1, -1).join('.');
  if (theme.length === 0) {
    return null;
  }
  return { bucket, theme, variation };
}
