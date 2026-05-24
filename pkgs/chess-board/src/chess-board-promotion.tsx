import {
  Box,
  Button,
  IconSymbol,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalRoot,
  Pressable,
  Text,
  useTheme,
} from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  Canvas,
  FilterMode,
  Image,
  MipmapMode,
  Rect,
  type SkImage,
} from '@shopify/react-native-skia';
import { useEffect, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
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

const promotionOptions = [
  { key: 'q', label: <Trans>Queen</Trans> },
  { key: 'r', label: <Trans>Rook</Trans> },
  { key: 'b', label: <Trans>Bishop</Trans> },
  { key: 'n', label: <Trans>Knight</Trans> },
] as const satisfies readonly {
  key: NonNullable<Move['promotion']>;
  label: ReactNode;
}[];

type PromotionKind = NonNullable<Move['promotion']>;
const ORDERED_PROMOTIONS: readonly PromotionKind[] = ['q', 'r', 'b', 'n'];

/**
 * @deprecated Prefer {@link ChessBoardPromotionInline} which renders inside
 * the board canvas. Kept for `promotionStyle: 'modal'` opt-in only.
 */
export function ChessBoardPromotionModal(props: {
  visible: boolean;
  onPick: (p: PromotionKind) => void;
  onCancel: () => void;
}): ReactNode {
  const { visible, onPick, onCancel } = props;
  const { t } = useLingui();

  const items = useMemo(() => promotionOptions, []);

  return (
    <ModalRoot visible={visible} onRequestClose={onCancel}>
      <ModalBackdrop onPress={onCancel}>
        <ModalContent style={{ maxWidth: 520 }}>
          <ModalHeader title={t`Promote pawn`} />
          <ModalBody>
            <Box sx={{ gap: 3 }}>
              <Text
                variant="body"
                sx={{ color: 'textSecondary' }}
                label={<Trans>Choose a piece to promote to.</Trans>}
              />
              <Box sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
                {items.map((it) => (
                  <Button
                    key={it.key}
                    title={it.label}
                    onPress={() => onPick(it.key)}
                  />
                ))}
                <Button
                  intent="neutral"
                  title={<Trans>Cancel</Trans>}
                  onPress={onCancel}
                />
              </Box>
            </Box>
          </ModalBody>
        </ModalContent>
      </ModalBackdrop>
    </ModalRoot>
  );
}

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
    <View
      pointerEvents="box-none"
      style={{
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
          style={{
            position: 'absolute',
            left: 0,
            top: idx * cell,
            width: cell,
            height: cell,
          }}
        />
      ))}
    </View>
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
      style={{
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

  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withTiming(1, {
      duration: 140,
      easing: Easing.out(Easing.cubic),
    });
  }, [enter]);

  const stackTopY = useMemo(
    () => computeStackTopY(destY, cell, color, orientation),
    [cell, color, destY, orientation]
  );

  const tiles = useMemo(
    () => computeTiles(cell, color, orientation, stackTopY),
    [cell, color, orientation, stackTopY]
  );

  const containerStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
  }));

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: size,
          height: size,
        },
        containerStyle,
      ]}
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
    </Animated.View>
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
  const appTheme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={t`Cancel promotion`}
      style={{
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
      <IconSymbol
        name="xmark"
        size={Math.max(12, size * 0.5)}
        color={appTheme.colors.text}
      />
    </Pressable>
  );
}
