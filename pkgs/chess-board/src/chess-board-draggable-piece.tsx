import { memo, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { withTiming } from 'react-native-reanimated';
import { Draggable } from 'react-native-reanimated-dnd';
import type { ChessPieceDragData } from './chess-board-dnd-types';
import { ChessBoardPieceArt } from './chess-board-piece-art';
import { squareToXY } from './chess-board-geometry';
import type { BoardOrientation, Square } from './chess-board-types';
import { useChessBoardPieceMotion } from './use-chess-board-piece-motion';

export type ChessBoardDraggablePieceProps = {
  data: ChessPieceDragData;
  size: number;
  orientation: BoardOrientation;
  pieceDraw: number;
  dragDisabled: boolean;
  onDragStart: (from: Square) => void;
  onDragEnd: () => void;
  onPress: (from: Square) => void;
};

/** Instant settle — avoids library spring fighting remount on drop. */
function snapAnimation(toValue: number): number {
  'worklet';
  return withTiming(toValue, { duration: 0 });
}

function ChessBoardDraggablePieceImpl(
  p: ChessBoardDraggablePieceProps
): ReactNode {
  const { x, y, cell } = squareToXY(p.data.from, p.size, p.orientation);
  const pad = (cell - p.pieceDraw) / 2;
  const motion = useChessBoardPieceMotion({
    left: x + pad,
    top: y + pad,
  });
  return (
    <Animated.View
      style={[
        motion.layoutStyle,
        { width: p.pieceDraw, height: p.pieceDraw },
      ]}
      pointerEvents="box-none"
    >
      <Draggable
        data={p.data}
        draggableId={p.data.id}
        dragDisabled={p.dragDisabled}
        collisionAlgorithm="center"
        preDragDelay={0}
        animationFunction={snapAnimation}
        onDragStart={(d) => {
          motion.onDragStartMotion();
          p.onDragStart(d.from);
        }}
        onDragEnd={() => {
          motion.onDragEndMotion();
          p.onDragEnd();
        }}
        style={styles.dragBody}
      >
        <Animated.View style={motion.liftStyle}>
          <ChessBoardPieceArt
            code={p.data.code}
            pieceDraw={p.pieceDraw}
            onPress={() => p.onPress(p.data.from)}
          />
        </Animated.View>
      </Draggable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dragBody: {
    width: '100%',
    height: '100%',
  },
});

export const ChessBoardDraggablePiece = memo(ChessBoardDraggablePieceImpl);
