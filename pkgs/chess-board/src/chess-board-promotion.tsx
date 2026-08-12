import { useLingui } from '@lingui/react/macro';
import { Box, Pressable, XIcon } from '@pkgs/ui';
import {
  Canvas,
  FilterMode,
  Image,
  MipmapMode,
  Rect,
  type SkImage,
} from '@shopify/react-native-skia';
import { type ReactNode, useMemo } from 'react';
import { squareToXY } from './chess-board-geometry';
import type {
  BoardOrientation,
  BoardTheme,
  Move,
  PieceCode,
  PieceColor,
  Square,
} from './chess-board-types';
import { pieceCode } from './chess-pieces-svg';

type PromotionKind = NonNullable<Move['promotion']>;
const ORDERED_PROMOTIONS: readonly PromotionKind[] = ['q', 'r', 'b', 'n'];

export type ChessBoardPromotionInlineProps = {
  /** Side promoting (whose pawn just moved). Determines orientation of the stack. */
  color: PieceColor;
  /** Destination square the pawn lands on. */
  to: Square;
  /** Board pixel size. */
  size: number;
  orientation: BoardOrientation;
  theme: BoardTheme;
  pieceImages: Partial<Record<PieceCode, SkImage>> | null;
  onPick: (p: PromotionKind) => void;
  onCancel: () => void;
};

type Tile = { kind: PromotionKind; cellY: number };

function computeStackTopY(
  destY: number,
  cell: number,
  color: PieceColor,
  orientation: BoardOrientation
): number {
  const fromTop = orientation === 'white' ? color === 'w' : color === 'b';
  if (fromTop) return destY;
  return destY - cell * 3;
}

function computeTiles(
  cell: number,
  color: PieceColor,
  orientation: BoardOrientation,
  stackTopY: number
): readonly Tile[] {
  const fromTop = orientation === 'white' ? color === 'w' : color === 'b';
  const seq: PromotionKind[] = fromTop
    ? [...ORDERED_PROMOTIONS]
    : [...ORDERED_PROMOTIONS].reverse();
  return seq.map((kind, idx) => ({
    kind,
    cellY: stackTopY + idx * cell,
  }));
}

type PromotionStackProps = {
  color: PieceColor;
  destX: number;
  stackTopY: number;
  cell: number;
  tiles: readonly Tile[];
  pieceImages: Partial<Record<PieceCode, SkImage>> | null;
  theme: BoardTheme;
  onPick: (p: PromotionKind) => void;
};

function PromotionStack({
  color,
  destX,
  stackTopY,
  cell,
  tiles,
  pieceImages,
  theme,
  onPick,
}: PromotionStackProps): ReactNode {
  return (
    <Box
      pointerEvents="box-none"
      sx={{
        position: 'absolute',
        left: destX,
        top: stackTopY,
        width: cell,
        height: cell * 4,
      }}
    >
      <Canvas style={{ width: cell, height: cell * 4 }}>
        <Rect
          x={0}
          y={0}
          width={cell}
          height={cell * 4}
          color={theme.promotion.surface}
        />
        {pieceImages
          ? tiles.map((tile, idx) => {
              const code = pieceCode(color, tile.kind);
              if (code === null) return null;
              const image = pieceImages[code];
              if (image === undefined) return null;
              const pad = cell * 0.06;
              return (
                <Image
                  key={`pinline-img-${tile.kind}`}
                  image={image}
                  x={pad}
                  y={idx * cell + pad}
                  width={cell - pad * 2}
                  height={cell - pad * 2}
                  sampling={{
                    filter: FilterMode.Linear,
                    mipmap: MipmapMode.Linear,
                  }}
                />
              );
            })
          : null}
      </Canvas>
      {tiles.map((tile, idx) => (
        <Pressable
          key={`pinline-tap-${tile.kind}`}
          onPress={() => onPick(tile.kind)}
          accessibilityRole="button"
          sx={{
            position: 'absolute',
            left: 0,
            top: idx * cell,
            width: cell,
            height: cell,
          }}
        />
      ))}
    </Box>
  );
}

function PromotionBackdrop({
  size,
  theme,
  onCancel,
}: {
  size: number;
  theme: BoardTheme;
  onCancel: () => void;
}): ReactNode {
  return (
    <Pressable
      onPress={onCancel}
      accessibilityRole="button"
      sx={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: size,
        height: size,
      }}
    >
      <Canvas style={{ width: size, height: size }}>
        <Rect
          x={0}
          y={0}
          width={size}
          height={size}
          color={theme.promotion.backdrop}
        />
      </Canvas>
    </Pressable>
  );
}

/**
 * Canvas-anchored promotion picker. Pops out from the destination square in
 * a vertical stack (Q top → N bottom in promotion direction). The whole board
 * dims behind it; tapping the dim region cancels.
 */
export function ChessBoardPromotionInline(
  props: ChessBoardPromotionInlineProps
): ReactNode {
  const { color, to, size, orientation, theme, pieceImages, onPick, onCancel } =
    props;
  const cell = size / 8;
  const { x: destX, y: destY } = squareToXY(to, size, orientation);

  const stackTopY = useMemo(
    () => computeStackTopY(destY, cell, color, orientation),
    [cell, color, destY, orientation]
  );

  const tiles = useMemo(
    () => computeTiles(cell, color, orientation, stackTopY),
    [cell, color, orientation, stackTopY]
  );

  return (
    <Box
      pointerEvents="box-none"
      sx={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: size,
        height: size,
      }}
    >
      <PromotionBackdrop size={size} theme={theme} onCancel={onCancel} />
      <PromotionStack
        color={color}
        destX={destX}
        stackTopY={stackTopY}
        cell={cell}
        tiles={tiles}
        pieceImages={pieceImages}
        theme={theme}
        onPick={onPick}
      />
      <CancelChip
        size={cell * 0.6}
        x={destX + cell + Math.max(6, cell * 0.08)}
        y={stackTopY + cell * 4 - cell * 0.6}
        theme={theme}
        onPress={onCancel}
      />
    </Box>
  );
}

function CancelChip({
  size,
  x,
  y,
  theme,
  onPress,
}: {
  size: number;
  x: number;
  y: number;
  theme: BoardTheme;
  onPress: () => void;
}): ReactNode {
  const { t } = useLingui();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={t`Cancel promotion`}
      sx={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        backgroundColor: theme.promotion.cancel,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <XIcon size={Math.max(12, size * 0.5)} color={theme.promotion.ink} />
    </Pressable>
  );
}
