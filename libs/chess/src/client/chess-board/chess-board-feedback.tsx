/* eslint-disable lingui/no-unlocalized-strings */
import {
  Circle,
  Group,
  Path,
  Skia,
  Text as SkiaText,
  type SkFont,
} from '@shopify/react-native-skia';
import { useEffect, useMemo, type ReactNode } from 'react';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { squareToXY } from './chess-board-geometry';
import { createChessBoardSkiaFont } from './chess-board-skia-font';
import type {
  BoardOrientation,
  BoardTheme,
  CellFeedback,
  CellFeedbackCorner,
  CellFeedbackKind,
  Square,
} from './chess-board-types';

/**
 * Vector glyph paths for non-text feedback kinds. Paths are authored in a
 * 100x100 viewBox and scaled into the badge bounds by callers.
 */
const GLYPH_PATHS_100: Partial<Record<CellFeedbackKind, string>> = {
  check: 'M18 54 L42 78 L84 26',
  cross: 'M22 22 L78 78 M78 22 L22 78',
  star: 'M50 10 L61 38 L92 40 L67 60 L75 90 L50 73 L25 90 L33 60 L8 40 L39 38 Z',
  crown: 'M14 30 L28 56 L42 22 L58 22 L72 56 L86 30 L82 80 L18 80 Z',
  dot: 'M50 50 m-26 0 a26 26 0 1 0 52 0 a26 26 0 1 0 -52 0',
};

const TEXT_GLYPH: Partial<Record<CellFeedbackKind, string>> = {
  exclamation: '!',
  doubleExclam: '!!',
  question: '?',
  questionExclam: '?!',
};

type CornerInput = {
  cell: number;
  squareX: number;
  squareY: number;
  corner: CellFeedbackCorner;
  badgeRadius: number;
};

function feedbackBadgeCenter(input: CornerInput): { cx: number; cy: number } {
  const { cell, squareX, squareY, corner, badgeRadius } = input;
  const inset = badgeRadius + cell * 0.04;
  switch (corner) {
    case 'topLeft':
      return { cx: squareX + inset, cy: squareY + inset };
    case 'topRight':
      return { cx: squareX + cell - inset, cy: squareY + inset };
    case 'bottomLeft':
      return { cx: squareX + inset, cy: squareY + cell - inset };
    case 'bottomRight':
      return { cx: squareX + cell - inset, cy: squareY + cell - inset };
    case 'center':
    default:
      return { cx: squareX + cell / 2, cy: squareY + cell / 2 };
  }
}

function strokeStyleForKind(kind: CellFeedbackKind): 'stroke' | 'fill' {
  if (
    kind === 'check' ||
    kind === 'cross' ||
    kind === 'doubleExclam' ||
    kind === 'questionExclam'
  )
    return 'stroke';
  return 'fill';
}

/**
 * Pulsing animated opacity multiplier for a feedback badge. Each rendered
 * badge owns one pulser at the top of render so we never call hooks
 * conditionally per cell.
 */
function useFeedbackPulse(active: boolean) {
  const t = useSharedValue(1);
  useEffect(() => {
    if (active) {
      t.value = withRepeat(
        withTiming(0.55, { duration: 700, easing: Easing.inOut(Easing.cubic) }),
        -1,
        true
      );
    } else {
      t.value = withTiming(1, { duration: 200 });
    }
  }, [active, t]);
  return useDerivedValue(() => t.value);
}

type SingleBadgeProps = {
  cellPx: number;
  cx: number;
  cy: number;
  fb: CellFeedback;
  theme: BoardTheme;
  font: SkFont | null;
};

type BadgeGlyphProps = {
  fb: CellFeedback;
  cx: number;
  cy: number;
  radius: number;
  color: string;
  font: SkFont | null;
};

function BadgeGlyph({
  fb,
  cx,
  cy,
  radius,
  color,
  font,
}: BadgeGlyphProps): ReactNode {
  const glyphPathStr = GLYPH_PATHS_100[fb.kind];
  const textGlyph = TEXT_GLYPH[fb.kind];

  const glyphPath = useMemo(() => {
    if (glyphPathStr === undefined) return null;
    return Skia.Path.MakeFromSVGString(glyphPathStr);
  }, [glyphPathStr]);

  const glyphScale = (radius * 1.6) / 100;
  const glyphTranslate = {
    x: cx - radius * 0.8,
    y: cy - radius * 0.8,
  };
  const style = strokeStyleForKind(fb.kind);

  if (glyphPath !== null) {
    return (
      <Group
        transform={[
          { translateX: glyphTranslate.x },
          { translateY: glyphTranslate.y },
          { scale: glyphScale },
        ]}
      >
        <Path
          path={glyphPath}
          color={color}
          style={style}
          strokeWidth={style === 'stroke' ? 100 * 0.13 : 0}
          strokeJoin="round"
          strokeCap="round"
        />
      </Group>
    );
  }

  if (textGlyph !== undefined) {
    if (font === null) return null;
    return (
      <SkiaText
        x={cx - radius * 0.55 * (textGlyph.length === 2 ? 1.2 : 0.6)}
        y={cy + radius * 0.45}
        text={textGlyph}
        font={font}
        color={color}
      />
    );
  }

  return null;
}

function SingleBadge({
  cellPx,
  cx,
  cy,
  fb,
  theme,
  font,
}: SingleBadgeProps): ReactNode {
  const radius = Math.max(8, cellPx * 0.16);
  const ringWidth = Math.max(1.5, cellPx * 0.025);
  const color = fb.color ?? theme.feedback[fb.kind];
  const baseOpacity = fb.opacity ?? 1;
  const pulseT = useFeedbackPulse(fb.pulse === true);
  const opacity = useDerivedValue(() => baseOpacity * pulseT.value);

  return (
    <Group opacity={opacity}>
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        color={theme.lightSquare}
        opacity={0.92}
      />
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        color={color}
        style="stroke"
        strokeWidth={ringWidth}
      />
      <BadgeGlyph
        fb={fb}
        cx={cx}
        cy={cy}
        radius={radius}
        color={color}
        font={font}
      />
    </Group>
  );
}

export type ChessBoardFeedbackProps = {
  cellFeedback: Partial<Record<Square, CellFeedback>> | undefined;
  size: number;
  orientation: BoardOrientation;
  theme: BoardTheme;
};

export function ChessBoardFeedback(props: ChessBoardFeedbackProps): ReactNode {
  const { cellFeedback, size, orientation, theme } = props;

  const cell = size / 8;
  const badgeRadius = Math.max(8, cell * 0.16);

  const font = useMemo(() => {
    const fontSize = Math.max(10, Math.floor(cell * 0.28));
    return createChessBoardSkiaFont(fontSize);
  }, [cell]);

  const entries = useMemo<readonly [Square, CellFeedback][]>(() => {
    if (!cellFeedback) return [];
    const out: [Square, CellFeedback][] = [];
    for (const [sq, fb] of Object.entries(cellFeedback)) {
      if (fb !== undefined) out.push([sq as Square, fb]);
    }
    return out;
  }, [cellFeedback]);

  if (entries.length === 0) return null;

  return (
    <Group>
      {entries.map(([sq, fb]) => {
        const corner: CellFeedbackCorner = fb.corner ?? 'topRight';
        const { x, y } = squareToXY(sq, size, orientation);
        const { cx, cy } = feedbackBadgeCenter({
          cell,
          squareX: x,
          squareY: y,
          corner,
          badgeRadius,
        });
        return (
          <SingleBadge
            key={`fb-${sq}`}
            cellPx={cell}
            cx={cx}
            cy={cy}
            fb={fb}
            theme={theme}
            font={font}
          />
        );
      })}
    </Group>
  );
}
