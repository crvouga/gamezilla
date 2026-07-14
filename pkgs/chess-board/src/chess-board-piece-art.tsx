import { memo, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { SvgXml } from 'react-native-svg';
import type { PieceCode } from './chess-board-types';
import { PIECE_SVGS } from './chess-pieces-svg';

export type ChessBoardPieceArtProps = {
  code: PieceCode;
  pieceDraw: number;
  onPress: () => void;
};

/** Piece SVG + tap target that composes with RNGH drag (no RN responder steal). */
function ChessBoardPieceArtImpl(p: ChessBoardPieceArtProps): ReactNode {
  const xml = PIECE_SVGS[p.code];
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      onPress={p.onPress}
      style={[styles.art, { width: p.pieceDraw, height: p.pieceDraw }]}
    >
      <SvgXml xml={xml} width={p.pieceDraw} height={p.pieceDraw} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  art: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const ChessBoardPieceArt = memo(ChessBoardPieceArtImpl);
